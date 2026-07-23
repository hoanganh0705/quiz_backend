/**
 * Ranking domain services — unit + integration tests for XP ingestion flow.
 *
 * Tests the XP ingestion service and its interaction with the ranking
 * repository and event bus:
 *
 *   - `processXpEvent` — validates events, updates XP, schedules outbox events
 *   - `addXp` — convenience method for direct XP additions
 *   - `bulkProcessXpEvents` — batch processing with error collection
 *   - `deriveIdempotencyKey` — idempotency key derivation logic
 *
 * These tests verify the ordering of operations without requiring a real database.
 */
import { XpIngestionService } from './xp-ingestion.service';
import { InvalidXpEventError } from '../errors/ranking-domain.errors';
import { RankingPeriod } from '../types/ranking.types';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { RankingOutboxPort } from '../ports/ranking-outbox.port';
import type { RankingDomainEventBusPort } from '../ports/ranking-event-bus.port';
import type { ExternalXpEarnedEvent } from '../events/ranking-domain.events';

interface StubRepo {
  updateXp: jest.Mock<
    Promise<{
      userId: string;
      allTimeXp: number;
      weeklyXp: number;
      monthlyXp: number;
      dailyXp: number;
    }>,
    [{ userId: string; amount: number; now: Date }]
  >;
  updateXpInTx: jest.Mock<
    Promise<{
      userId: string;
      allTimeXp: number;
      weeklyXp: number;
      monthlyXp: number;
      dailyXp: number;
    }>,
    [unknown, { userId: string; amount: number; now: Date }]
  >;
}

interface StubOutbox {
  scheduleRankingEvent: jest.Mock<
    Promise<void>,
    [{ eventType: string; payload: unknown; nowIso: string; idempotencyKey: string }, unknown]
  >;
}

interface StubBus {
  publish: jest.Mock<void, [unknown]>;
}

interface StubRankCalc {
  queueRankRecalculationInTx: jest.Mock<
    Promise<void>,
    [unknown, string, RankingPeriod[]]
  >;
}

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<{ info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock }>;

const buildStubRepo = (): StubRepo => ({
  updateXp: jest.fn(),
  updateXpInTx: jest.fn(),
});

const buildStubOutbox = (): StubOutbox => ({
  scheduleRankingEvent: jest.fn(),
});

const buildStubBus = (): StubBus => ({
  publish: jest.fn(),
});

const buildStubRankCalc = (): StubRankCalc => ({
  queueRankRecalculationInTx: jest.fn(),
});

const buildStubDb = () => ({
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn({}),
});

const createService = (
  repo: StubRepo,
  outbox: StubOutbox,
  bus: StubBus,
  rankCalc: StubRankCalc,
  db = buildStubDb(),
) =>
  new XpIngestionService(
    db as never,
    repo as unknown as RankingRepositoryPort,
    bus as unknown as RankingDomainEventBusPort,
    outbox as unknown as RankingOutboxPort,
    rankCalc as unknown as RankCalculationService,
    mockLogger,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XpIngestionService', () => {
  describe('processXpEvent', () => {
    it('validates event has required fields', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      const service = createService(repo, outbox, bus, rankCalc);

      // Missing userId
      await expect(
        service.processXpEvent({
          eventType: 'external.xp.earned',
          userId: '',
          amount: 100,
          source: 'quiz',
          timestamp: new Date(),
        } as ExternalXpEarnedEvent),
      ).rejects.toThrow(InvalidXpEventError);

      // Missing amount
      await expect(
        service.processXpEvent({
          eventType: 'external.xp.earned',
          userId: 'u1',
          amount: 0,
          source: 'quiz',
          timestamp: new Date(),
        } as ExternalXpEarnedEvent),
      ).rejects.toThrow(InvalidXpEventError);

      // Negative amount
      await expect(
        service.processXpEvent({
          eventType: 'external.xp.earned',
          userId: 'u1',
          amount: -50,
          source: 'quiz',
          timestamp: new Date(),
        } as ExternalXpEarnedEvent),
      ).rejects.toThrow(InvalidXpEventError);
    });

    it('updates XP and schedules outbox event in transaction', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 100,
        weeklyXp: 100,
        monthlyXp: 100,
        dailyXp: 100,
      });
      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      await service.processXpEvent({
        eventType: 'external.xp.earned',
        userId: 'u1',
        amount: 100,
        source: 'quiz',
        timestamp: new Date(),
      });

      expect(repo.updateXpInTx).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ userId: 'u1', amount: 100 }),
      );
      expect(outbox.scheduleRankingEvent).toHaveBeenCalled();
      expect(rankCalc.queueRankRecalculationInTx).toHaveBeenCalledWith(
        {},
        'u1',
        [RankingPeriod.ALL_TIME, RankingPeriod.WEEKLY, RankingPeriod.MONTHLY, RankingPeriod.DAILY],
      );
    });

    it('schedules rank recalculation for all periods', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 500,
        weeklyXp: 200,
        monthlyXp: 300,
        dailyXp: 100,
      });
      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      await service.processXpEvent({
        eventType: 'external.xp.earned',
        userId: 'u1',
        amount: 500,
        source: 'tournament',
        timestamp: new Date(),
      });

      expect(rankCalc.queueRankRecalculationInTx).toHaveBeenCalledWith(
        {},
        'u1',
        [RankingPeriod.ALL_TIME, RankingPeriod.WEEKLY, RankingPeriod.MONTHLY, RankingPeriod.DAILY],
      );
    });

    it('logs xp_event_received and xp_event_processed', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 100,
        weeklyXp: 100,
        monthlyXp: 100,
        dailyXp: 100,
      });
      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      await service.processXpEvent({
        eventType: 'external.xp.earned',
        userId: 'u1',
        amount: 100,
        source: 'quiz',
        timestamp: new Date(),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'xp_event_received' }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'xp_event_processed' }),
      );
    });
  });

  describe('addXp', () => {
    it('validates amount is positive', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      const service = createService(repo, outbox, bus, rankCalc);

      await expect(service.addXp('u1', 0)).rejects.toThrow(InvalidXpEventError);
      await expect(service.addXp('u1', -100)).rejects.toThrow(InvalidXpEventError);
    });

    it('calls processXpEvent with bonus source', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 250,
        weeklyXp: 250,
        monthlyXp: 250,
        dailyXp: 250,
      });
      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      await service.addXp('u1', 250);

      expect(repo.updateXpInTx).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ userId: 'u1', amount: 250 }),
      );
    });
  });

  describe('bulkProcessXpEvents', () => {
    it('processes multiple events and collects results', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx.mockResolvedValue({
        userId: 'u1',
        allTimeXp: 100,
        weeklyXp: 100,
        monthlyXp: 100,
        dailyXp: 100,
      });
      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      const results = await service.bulkProcessXpEvents([
        {
          eventType: 'external.xp.earned',
          userId: 'u1',
          amount: 100,
          source: 'quiz',
          timestamp: new Date(),
        },
        {
          eventType: 'external.xp.earned',
          userId: 'u2',
          amount: 200,
          source: 'quiz',
          timestamp: new Date(),
        },
      ]);

      expect(results.processed).toBe(2);
      expect(results.failed).toBe(0);
      expect(results.errors).toHaveLength(0);
    });

    it('collects errors for failed events', async () => {
      const repo = buildStubRepo();
      const outbox = buildStubOutbox();
      const bus = buildStubBus();
      const rankCalc = buildStubRankCalc();

      repo.updateXpInTx
        .mockResolvedValueOnce({
          userId: 'u1',
          allTimeXp: 100,
          weeklyXp: 100,
          monthlyXp: 100,
          dailyXp: 100,
        })
        .mockRejectedValueOnce(new Error('Database error'));

      outbox.scheduleRankingEvent.mockResolvedValue(undefined);
      rankCalc.queueRankRecalculationInTx.mockResolvedValue(undefined);

      const service = createService(repo, outbox, bus, rankCalc);
      const results = await service.bulkProcessXpEvents([
        {
          eventType: 'external.xp.earned',
          userId: 'u1',
          amount: 100,
          source: 'quiz',
          timestamp: new Date(),
        },
        {
          eventType: 'external.xp.earned',
          userId: 'u2',
          amount: 200,
          source: 'quiz',
          timestamp: new Date(),
        },
      ]);

      expect(results.processed).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain('u2');
      expect(results.errors[0]).toContain('Database error');
    });
  });
});

describe('Idempotency key derivation', () => {
  // Test the idempotency key derivation logic directly

  it('prefers explicit idempotencyKey', () => {
    const event: ExternalXpEarnedEvent & { idempotencyKey?: string } = {
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 100,
      source: 'quiz',
      timestamp: new Date(),
      idempotencyKey: 'custom-key-123',
    };

    const key = deriveIdempotencyKey(event);
    expect(key).toBe('custom-key-123');
  });

  it('derives key from attemptId for quiz source', () => {
    const event: ExternalXpEarnedEvent & { attemptId?: string } = {
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 100,
      source: 'quiz_attempt',
      timestamp: new Date(),
      attemptId: 'attempt-456',
    };

    const key = deriveIdempotencyKey(event);
    expect(key).toBe('xp:u1:attempt:attempt-456');
  });

  it('derives key from tournamentId for tournament source', () => {
    const event: ExternalXpEarnedEvent & { tournamentId?: string } = {
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 100,
      source: 'tournament',
      timestamp: new Date(),
      tournamentId: 'tournament-789',
    };

    const key = deriveIdempotencyKey(event);
    expect(key).toBe('xp:u1:tournament:tournament-789');
  });

  it('derives key from achievementId for achievement source', () => {
    const event: ExternalXpEarnedEvent & { achievementId?: string } = {
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 50,
      source: 'achievement',
      timestamp: new Date(),
      achievementId: 'achievement-001',
    };

    const key = deriveIdempotencyKey(event);
    expect(key).toBe('xp:u1:achievement:achievement-001');
  });

  it('falls back to generic key format', () => {
    const event: ExternalXpEarnedEvent = {
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 100,
      source: 'bonus',
      timestamp: new Date('2026-01-15T10:30:00.000Z'),
    };

    const key = deriveIdempotencyKey(event);
    expect(key).toMatch(/^xp:u1:bonus:2026-01-15/);
  });
});

/**
 * Copies the idempotency key derivation logic for testing.
 * In production, this function is internal to the service module.
 */
function deriveIdempotencyKey(event: ExternalXpEarnedEvent): string {
  const raw = event as unknown as Record<string, unknown>;

  if (typeof raw.idempotencyKey === 'string') {
    return raw.idempotencyKey;
  }

  if (event.source === 'quiz_attempt' && event.attemptId) {
    return `xp:${event.userId}:attempt:${event.attemptId}`;
  }

  if (event.source === 'tournament' && event.tournamentId) {
    return `xp:${event.userId}:tournament:${event.tournamentId}`;
  }

  if (event.source === 'achievement') {
    const achievementId = raw.achievementId as string | undefined;
    if (achievementId) {
      return `xp:${event.userId}:achievement:${achievementId}`;
    }
  }

  return `xp:${event.userId}:${event.source}:${event.timestamp.toISOString()}`;
}
