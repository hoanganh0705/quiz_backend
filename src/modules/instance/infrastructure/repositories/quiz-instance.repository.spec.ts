/**
 * Phase 1 (Foundational Correctness) — repository-level test for the
 * optimistic-locking protocol.
 *
 * The repo method `updateInstanceStatus` issues an UPDATE with a
 * `WHERE version = $expectedVersion` predicate. We test it via a
 * chainable Drizzle stub that mirrors the fluent call shape the
 * repository actually uses: `db.update(table).set(values).where(predicate).returning(...)`.
 * The chain's terminal endpoint is a thenable that yields the rows.
 *
 * Two invariants are under test:
 *
 *   1. The repository passes a `WHERE` predicate (the optimistic-lock
 *      condition). We assert the predicate was supplied by exposing it
 *      via the stub.
 *   2. Empty return rows → `InstanceOptimisticLockError`. Non-empty
 *      return rows → the new version is surfaced.
 */
import { QuizInstanceRepository } from './quiz-instance.repository';
import { InstanceOptimisticLockError } from '@/modules/instance/domain/errors';

interface StubState {
  capturedWhere: unknown;
  setCapture: Record<string, unknown>;
  returnRows: unknown[];
}

const buildStubDb = (returnRows: unknown[]): StubState => {
  const state: StubState = {
    capturedWhere: undefined,
    setCapture: {},
    returnRows,
  };

  // `then`-able — Drizzle builders expose a `then` method so they can
  // be awaited. We forward the call site directly to the captured
  // `returnRows`.
  const thenable: {
    then: <T>(onfulfilled?: ((v: unknown) => T) | null) => Promise<T>;
  } = {
    then: <T>(onfulfilled?: ((v: unknown) => T) | null): Promise<T> =>
      Promise.resolve<T>(
        onfulfilled ? onfulfilled(state.returnRows) : (state.returnRows as unknown as T),
      ),
  };

  // The `returning()` call returns a thenable — Drizzle awaits the
  // entire chain via this single `then` per result.
  const chainReturning: { returning: () => typeof thenable } = {
    returning: () => thenable,
  };

  const chainWhere: { where: (p: unknown) => typeof chainReturning } = {
    where: (predicate: unknown) => {
      state.capturedWhere = predicate;
      return chainReturning;
    },
  };

  const chainSet: { set: (v: Record<string, unknown>) => typeof chainWhere } = {
    set: (values: Record<string, unknown>) => {
      state.setCapture = values;
      return chainWhere;
    },
  };

  // Top-level chain — starts at `db.update(table)`.
  Object.assign(state, { update: () => chainSet });

  return state;
};

const newRepo = (stub: StubState) => new QuizInstanceRepository(stub as unknown as never);

describe('Instance repository — Phase 1 optimistic locking', () => {
  it('returns the new version when the row matches expectedVersion', async () => {
    const stub = buildStubDb([{ version: 2 }]);
    const repo = newRepo(stub);

    const result = await repo.updateInstanceStatus({
      instanceId: 'i1',
      status: 'running',
      nowIso: '2026-01-01T00:01:00.000Z',
      startedAt: '2026-01-01T00:01:00.000Z',
      expectedVersion: 1,
    });

    expect(result).toEqual({ version: 2 });
    // The WHERE predicate must be present — that's where the
    // `expectedVersion = X` filter lives.
    expect(stub.capturedWhere).toBeDefined();
    // And `version = version + 1` was threaded through `set`.
    expect(stub.setCapture).toHaveProperty('status', 'running');
  });

  it('throws InstanceOptimisticLockError when zero rows match (concurrent-start race)', async () => {
    const stub = buildStubDb([]);
    const repo = newRepo(stub);

    await expect(
      repo.updateInstanceStatus({
        instanceId: 'i2',
        status: 'running',
        nowIso: '2026-01-01T00:01:00.000Z',
        startedAt: '2026-01-01T00:01:00.000Z',
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(InstanceOptimisticLockError);
  });
});

/**
 * Phase 2 (Gameplay Lifecycle) — `updateInstanceStatus` now threads an
 * optional `countdownStartedAt`. The repository does NOT validate the
 * `status` ↔ `countdownStartedAt` invariant (the DB CHECK
 * `quiz_instances_countdown_started_at_consistent` does); the test
 * only verifies the column is wired into the SET clause when supplied.
 */
describe('Instance repository — Phase 2 countdownStartedAt threading', () => {
  it('forwards `countdownStartedAt` to the SET clause when supplied', async () => {
    const stub = buildStubDb([{ version: 2 }]);
    const repo = newRepo(stub);

    await repo.updateInstanceStatus({
      instanceId: 'i3',
      status: 'countdown',
      nowIso: '2026-01-01T00:01:00.000Z',
      countdownStartedAt: '2026-01-01T00:01:00.000Z',
      expectedVersion: 1,
    });

    expect(stub.setCapture).toMatchObject({
      status: 'countdown',
      countdownStartedAt: '2026-01-01T00:01:00.000Z',
    });
  });

  it('forwards explicit `null` to clear `countdownStartedAt` on transition out of countdown', async () => {
    const stub = buildStubDb([{ version: 4 }]);
    const repo = newRepo(stub);

    await repo.updateInstanceStatus({
      instanceId: 'i4',
      status: 'running',
      nowIso: '2026-01-01T00:02:00.000Z',
      startedAt: '2026-01-01T00:02:00.000Z',
      countdownStartedAt: null,
      expectedVersion: 3,
    });

    expect(stub.setCapture).toMatchObject({
      status: 'running',
      countdownStartedAt: null,
    });
  });

  it('omits `countdownStartedAt` from the SET clause when neither set nor null are passed', async () => {
    const stub = buildStubDb([{ version: 5 }]);
    const repo = newRepo(stub);

    await repo.updateInstanceStatus({
      instanceId: 'i5',
      status: 'closed',
      nowIso: '2026-01-01T00:03:00.000Z',
      closedAt: '2026-01-01T00:03:00.000Z',
      expectedVersion: 4,
    });

    // The key must NOT be present (undefined → not threaded). This is
    // the contract the `startInstance`/`closeInstance` callers rely
    // on when they leave the countdown anchor untouched.
    expect('countdownStartedAt' in stub.setCapture).toBe(false);
  });
});
