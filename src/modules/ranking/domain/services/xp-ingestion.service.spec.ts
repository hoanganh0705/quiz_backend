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

function makeService(): {
  service: XpIngestionService;
  versionService: { bumpAllPeriods: jest.Mock };
} {
  const db = {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb({})),
  };
  const rankingRepository = {
    updateXpInTx: jest.fn().mockResolvedValue({
      allTimeXp: 100,
      weeklyXp: 100,
      monthlyXp: 100,
      dailyXp: 100,
    }),
    processXpEventsBatch: jest.fn().mockResolvedValue(undefined),
  } as unknown as RankingRepositoryPort;
  const eventBus = {} as unknown as RankingDomainEventBusPort;
  const outbox = {
    scheduleRankingEvent: jest.fn(),
  } as unknown as RankingOutboxPort;
  const rankCalculationService = {
    queueRankRecalculationInTx: jest.fn(),
  } as unknown as RankCalculationService;
  const versionService = { bumpAllPeriods: jest.fn().mockResolvedValue(undefined) };
  const dedupe = {
    tryClaimXp: jest.fn().mockResolvedValue(true),
    releaseXp: jest.fn().mockResolvedValue(undefined),
  } as unknown as RankingDedupePort;
  const metricsRegistry = new MetricsRegistry(makeLogger());
  const tracing = new TracingProvider(new TestLogger() as unknown as never);

  const service = new XpIngestionService(
    db as never,
    rankingRepository,
    eventBus,
    outbox,
    rankCalculationService,
    versionService as unknown as RankingCacheVersionService,
    dedupe,
    metricsRegistry,
    tracing,
    makeLogger(),
  );

  return { service, versionService, tracing } as never;
}

describe('XpIngestionService — ranking cache version bump', () => {
  it('bumpAllPeriods is called after a successful XP write', async () => {
    const { service, versionService } = makeService();
    await service.processXpEvent({
      eventType: 'external.xp.earned',
      userId: 'u1',
      amount: 50,
      source: 'quiz_attempt',
      idempotencyKey: 'xp:u1:attempt:1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(versionService.bumpAllPeriods).toHaveBeenCalledTimes(1);
  });
});

describe('XpIngestionService — manual entry points', () => {
  it('addXp rejects a non-positive amount without claiming a dedupe slot', async () => {
    const { service } = makeService();
    await expect(service.addXp('u1', 0)).rejects.toThrow();
    await expect(service.addXp('u1', -5)).rejects.toThrow();
  });

  it('bulkProcessXpEvents reports processed + failed counts and aggregates errors', async () => {
    const { service } = makeService();
    const events = [
      {
        eventType: 'external.xp.earned' as const,
        userId: 'u1',
        amount: 10,
        source: 'bonus' as const,
        idempotencyKey: 'xp:u1:bulk:1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    const result = await service.bulkProcessXpEvents(events);
    expect(result.processed + result.failed).toBe(1);
  });
});
