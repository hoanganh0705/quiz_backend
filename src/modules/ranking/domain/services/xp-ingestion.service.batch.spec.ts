import type { PinoLogger } from 'nestjs-pino';
import { XpIngestionService } from './xp-ingestion.service';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { RankingDomainEventBusPort } from '../ports/ranking-event-bus.port';
import type { RankingOutboxPort } from '../ports/ranking-outbox.port';
import type { RankingDedupePort } from '../ports/ranking-dedupe.port';
import type { RankCalculationService } from './rank-calculation.service';
import type { RankingCacheVersionService } from './ranking-cache-version.service';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import { TracingProvider } from '@/core/observability/tracing.provider';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

class TestLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

function makeService(deps?: {
  rankingRepository?: Partial<RankingRepositoryPort>;
  db?: object;
  outbox?: Partial<RankingOutboxPort>;
  dedupe?: Partial<RankingDedupePort>;
  rankCalculationService?: Partial<RankCalculationService>;
}) {
  const txStatements: unknown[] = [];
  const db = {
    transaction: jest.fn(async (cb: (tx: object) => Promise<void>) => {
      const tx = {
        execute: jest.fn(async (stmt: unknown) => {
          txStatements.push(stmt);
          return { rowCount: 1 };
        }),
      };
      await cb(tx);
    }),
  };

  const rankingRepository = {
    updateXpInTx: jest.fn(),
    processXpEventsBatch: jest.fn().mockResolvedValue(undefined),
    ...deps?.rankingRepository,
  } as unknown as RankingRepositoryPort;

  const outbox = {
    scheduleRankingEvent: jest.fn().mockResolvedValue(undefined),
    ...deps?.outbox,
  };

  const dedupe = {
    tryClaimXp: jest.fn().mockResolvedValue(true),
    releaseXp: jest.fn().mockResolvedValue(undefined),
    ...deps?.dedupe,
  };

  const rankCalcPartial = deps?.rankCalculationService;
  const queueRankRecalculationInTx = jest
    .fn()
    .mockImplementation(rankCalcPartial?.queueRankRecalculationInTx as () => Promise<void>);

  const rankCalculationService = {
    ...rankCalcPartial,
    queueRankRecalculationInTx,
  } as unknown as RankCalculationService;

  const versionService = { bumpAllPeriods: jest.fn().mockResolvedValue(undefined) };
  const metricsRegistry = new MetricsRegistry(makeLogger());
  const tracing = new TracingProvider(new TestLogger() as unknown as never);

  const service = new XpIngestionService(
    db as never,
    rankingRepository,
    {} as RankingDomainEventBusPort,
    outbox,
    rankCalculationService,
    versionService as unknown as RankingCacheVersionService,
    dedupe,
    metricsRegistry,
    tracing,
    makeLogger(),
  );

  return { service, db, rankingRepository, outbox, dedupe, txStatements, rankCalculationService };
}

describe('XpIngestionService — bulkProcessXpEvents batch', () => {
  it('calls processXpEventsBatch with valid events inside a transaction', async () => {
    const { service, rankingRepository } = makeService();

    const events = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 10,
        source: 'quiz_attempt' as const,
        idempotencyKey: 'xp:u1:bulk:1',
        timestamp: new Date(),
      },
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u2',
        amount: 20,
        source: 'quiz_attempt' as const,
        idempotencyKey: 'xp:u2:bulk:2',
        timestamp: new Date(),
      },
    ];

    const result = await service.bulkProcessXpEvents(events);

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(rankingRepository.processXpEventsBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ userId: 'u1', amount: 10 }),
          expect.objectContaining({ userId: 'u2', amount: 20 }),
        ]),
      }),
    );
  });

  it('rejects invalid events (zero amount) without calling processXpEventsBatch', async () => {
    const { service, rankingRepository } = makeService();

    const events = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 0,
        source: 'bonus' as const,
        idempotencyKey: 'xp:u1:bulk:1',
        timestamp: new Date(),
      },
    ];

    const result = await service.bulkProcessXpEvents(events);

    expect(result.failed).toBe(1);
    expect(rankingRepository.processXpEventsBatch).not.toHaveBeenCalled();
  });

  it('skips duplicate events without calling processXpEventsBatch', async () => {
    const { service, rankingRepository, dedupe } = makeService();
    dedupe.tryClaimXp = jest.fn().mockResolvedValue(false);

    const events = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 10,
        source: 'bonus' as const,
        idempotencyKey: 'xp:u1:dup:1',
        timestamp: new Date(),
      },
    ];

    const result = await service.bulkProcessXpEvents(events);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(rankingRepository.processXpEventsBatch).not.toHaveBeenCalled();
  });

  it('enqueues recalculation for unique users after batch XP update', async () => {
    const { service, rankCalculationService } = makeService();

    const events = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 10,
        source: 'bonus' as const,
        idempotencyKey: 'xp:u1:bulk:1',
        timestamp: new Date(),
      },
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 5,
        source: 'bonus' as const,
        idempotencyKey: 'xp:u1:bulk:2',
        timestamp: new Date(),
      },
    ];

    await service.bulkProcessXpEvents(events);

    const uniqueUsers = [...new Set(events.map((e) => e.userId))];
    expect(rankCalculationService.queueRankRecalculationInTx).toHaveBeenCalledTimes(
      uniqueUsers.length,
    );
  });
});
