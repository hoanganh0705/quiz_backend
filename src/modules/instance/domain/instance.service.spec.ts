/**
 * Phase 2 (Gameplay Lifecycle) — domain-level tests for the countdown
 * lifecycle. The test surface covers:
 *
 *   - Minimum-player validation in `startInstance`
 *   - Countdown state-machine invariants
 *   - Scheduler-driven countdown completion
 *
 * We use a hand-rolled stub repository instead of a Drizzle mock; the
 * goal is to verify the *ordering* of state checks (read → validate →
 * update → emit), not the SQL surface.
 *
 * Phase 1 covered the optimistic-locking `WHERE version = X` predicate
 * at the repository layer; this spec exercises the domain's error
 * translation on top of it.
 */
import { InstanceService } from './instance.service';
import {
  InstanceNotInCountdownError,
  MinPlayersNotMetError,
  InstanceCountdownAlreadyStartedError,
  InstanceNotFoundError,
  InstanceNotHostError,
} from './errors';
import {
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
  InstanceStartedEvent,
} from './events';
import type { QuizInstanceRow } from './ports';
import type { InstanceDomainEventBusPort } from './events';

interface StubRepo {
  getInstanceById: jest.Mock<Promise<QuizInstanceRow | null>, [string]>;
  updateInstanceStatus: jest.Mock<
    Promise<{ version: number }>,
    [
      {
        instanceId: string;
        status: string;
        nowIso: string;
        startedAt?: string;
        closedAt?: string;
        countdownStartedAt?: string | null;
        expectedVersion: number;
      },
    ]
  >;
  countPlayers: jest.Mock<Promise<number>, [string]>;
}

interface StubBus {
  emitCountdownStarted: jest.Mock<void, [CountdownStartedEvent]>;
  emitCountdownCancelled: jest.Mock<void, [CountdownCancelledEvent]>;
  emitCountdownCompleted: jest.Mock<void, [CountdownCompletedEvent]>;
  emitInstanceStarted: jest.Mock<void, [InstanceStartedEvent]>;
}

const baseRow = (overrides: Partial<QuizInstanceRow> = {}): QuizInstanceRow => ({
  instanceId: 'i1',
  quizVersionId: 'qv1',
  hostUserId: 'u1',
  maxPlayers: 10,
  status: 'countdown',
  createdAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  closedAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  countdownStartedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

/**
 * Helper that wraps a synchronous return value in a resolved Promise.
 * The codebase's eslint config flags `jest.fn(() => ok(X))` as an
 * arrow with no `await`, so we prefer explicit `Promise.resolve`.
 */
const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

const newSvc = (repo: { [k: string]: jest.Mock }, bus: { [k: string]: jest.Mock }) =>
  new InstanceService(
    repo as unknown as StubRepo as unknown as never,
    bus as unknown as StubBus as unknown as InstanceDomainEventBusPort,
    // Logger is only used for `.info(...)` / `.error(...)`; we pass a
    // PinoLogger-compatible stub to avoid booting the DI container.
    {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as never,
  );

const user = { sub: 'u1', role: 'user' as const };

describe('InstanceService — Phase 2 countdown lifecycle', () => {
  describe('startInstance — minimum player guard', () => {
    it('rejects with MinPlayersNotMetError when fewer than 2 players are joined', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 2 })),
        countPlayers: jest.fn(() => ok(1)),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.startInstance('i1', user)).rejects.toBeInstanceOf(MinPlayersNotMetError);
      expect(repo.updateInstanceStatus).not.toHaveBeenCalled();
      expect(bus.emitInstanceStarted).not.toHaveBeenCalled();
    });

    it('transitions `countdown → running` when ≥2 players are joined', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 2 })),
        countPlayers: jest.fn(() => ok(2)),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.startInstance('i1', user)).resolves.toEqual({
        message: 'Instance started',
      });
      expect(repo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'i1',
          status: 'running',
          expectedVersion: 1,
          countdownStartedAt: null,
        }),
      );
      expect(bus.emitInstanceStarted).toHaveBeenCalledTimes(1);
    });

    it('rejects when status is `open` (must call startCountdown first)', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'open' }))),
        updateInstanceStatus: jest.fn(),
        countPlayers: jest.fn(() => ok(2)),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.startInstance('i1', user)).rejects.toBeInstanceOf(
        InstanceNotInCountdownError,
      );
      expect(repo.updateInstanceStatus).not.toHaveBeenCalled();
    });
  });

  describe('startCountdown', () => {
    it('rejects with InstanceCountdownAlreadyStartedError when already counting', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.startCountdown('i1', user)).rejects.toBeInstanceOf(
        InstanceCountdownAlreadyStartedError,
      );
      expect(bus.emitCountdownStarted).not.toHaveBeenCalled();
    });

    it('rejects non-host callers', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'open' }))),
        updateInstanceStatus: jest.fn(),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(
        svc.startCountdown('i1', { sub: 'intruder', role: 'user' }),
      ).rejects.toBeInstanceOf(InstanceNotHostError);
    });

    it('rejects missing instances', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(null)),
        updateInstanceStatus: jest.fn(),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.startCountdown('missing', user)).rejects.toBeInstanceOf(
        InstanceNotFoundError,
      );
    });

    it('persists `countdownStartedAt` and emits `CountdownStartedEvent` on success', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'open' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 2 })),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      const result = await svc.startCountdown('i1', user);
      expect(result.status).toBe('countdown');
      expect(repo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'i1',
          status: 'countdown',
          expectedVersion: 1,
        }),
      );
      // `countdownEndsAt - countdownStartedAt = COUNTDOWN_DURATION_MS = 5000ms`.
      // The repository thread validates the underlying state; here we
      // verify the *service* shape — both timestamps must be ISO 8601
      // and exactly 5 seconds apart.
      const deltaMs =
        new Date(result.countdownEndsAt).getTime() - new Date(result.countdownStartedAt).getTime();
      expect(deltaMs).toBe(InstanceService.COUNTDOWN_DURATION_MS);
      expect(bus.emitCountdownStarted).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelCountdown', () => {
    it('returns `countdown → open` and emits `CountdownCancelledEvent`', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 3 })),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.cancelCountdown('i1', user)).resolves.toEqual({
        message: 'Countdown cancelled',
      });
      expect(repo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'i1',
          status: 'open',
          countdownStartedAt: null,
        }),
      );
      expect(bus.emitCountdownCancelled).toHaveBeenCalledTimes(1);
    });

    it('rejects when not in countdown (status = open)', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'open' }))),
        updateInstanceStatus: jest.fn(),
        countPlayers: jest.fn(),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      await expect(svc.cancelCountdown('i1', user)).rejects.toBeInstanceOf(
        InstanceNotInCountdownError,
      );
    });
  });

  describe('completeCountdownByScheduler', () => {
    it('fires `countdown → running` and emits `CountdownCompletedEvent` + `InstanceStartedEvent`', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 5 })),
        countPlayers: jest.fn(() => ok(3)),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      const result = await svc.completeCountdownByScheduler({
        instanceId: 'i1',
        expectedVersion: 4,
      });
      expect(result.completed).toBe(true);
      expect(repo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'i1',
          status: 'running',
          expectedVersion: 4,
          countdownStartedAt: null,
        }),
      );
      expect(bus.emitCountdownCompleted).toHaveBeenCalledTimes(1);
      expect(bus.emitInstanceStarted).toHaveBeenCalledTimes(1);
    });

    it('auto-cancels when players have dropped below the minimum', async () => {
      const repo: { [k: string]: jest.Mock } = {
        getInstanceById: jest.fn(() => ok(baseRow({ status: 'countdown' }))),
        updateInstanceStatus: jest.fn(() => ok({ version: 6 })),
        countPlayers: jest.fn(() => ok(1)),
      };
      const bus: { [k: string]: jest.Mock } = {
        emitCountdownStarted: jest.fn(),
        emitCountdownCancelled: jest.fn(),
        emitCountdownCompleted: jest.fn(),
        emitInstanceStarted: jest.fn(),
      };
      const svc = newSvc(repo, bus);

      const result = await svc.completeCountdownByScheduler({
        instanceId: 'i1',
        expectedVersion: 5,
      });
      expect(result.completed).toBe(false);
      if (result.completed) {
        throw new Error('expected completed=false branch');
      }
      expect(result.reason).toBe('min_players_not_met');
      expect(repo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'i1',
          status: 'open',
          countdownStartedAt: null,
        }),
      );
      expect(bus.emitCountdownCancelled).toHaveBeenCalledTimes(1);
      expect(bus.emitInstanceStarted).not.toHaveBeenCalled();
    });
  });

  describe('MIN_PLAYERS_PER_INSTANCE constant', () => {
    it('is exactly 2 (the multiplayer-only invariant)', () => {
      expect(InstanceService.MIN_PLAYERS_PER_INSTANCE).toBe(2);
    });
  });
});
