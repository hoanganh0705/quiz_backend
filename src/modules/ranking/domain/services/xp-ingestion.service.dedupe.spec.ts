import type { PinoLogger } from 'nestjs-pino';
import { XpIngestionService } from './xp-ingestion.service';
import type { RankingRepositoryPort } from '../ports/ranking-repository.port';
import type { RankingDomainEventBusPort } from '../ports/ranking-event-bus.port';
import type { RankingOutboxPort } from '../ports/ranking-outbox.port';
import type { XpIngestSource } from '../ports/ranking-dedupe.port';
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

class TestTracingLogger {
  readonly info = jest.fn();
  readonly warn = jest.fn();
  readonly error = jest.fn();
  readonly debug = jest.fn();
}

interface Harness {
  service: XpIngestionService;
  rankingRepository: { updateXpInTx: jest.Mock };
  dedupe: { tryClaimXp: jest.Mock; releaseXp: jest.Mock };
  db: { transaction: jest.Mock };
  metrics: MetricsRegistry;
  tracing: TracingProvider;
}

function makeHarness(opts: { claimResult: boolean }): Harness {
  const db = {
    transaction: jest.fn((cb: (tx: unknown) => Promise<void>) => cb({})),
  };
  const rankingRepository = {
    updateXpInTx: jest.fn().mockResolvedValue({
      allTimeXp: 100,
      weeklyXp: 100,
      monthlyXp: 100,
      dailyXp: 100,
    }),
  };
  const eventBus = {} as unknown as RankingDomainEventBusPort;
  const outbox = {
    scheduleRankingEvent: jest.fn(),
  } as unknown as RankingOutboxPort;
  const rankCalculationService = {
    queueRankRecalculationInTx: jest.fn(),
  } as unknown as RankCalculationService;
  const versionService = { bumpAllPeriods: jest.fn().mockResolvedValue(undefined) };
  const dedupe = {
    tryClaimXp: jest.fn().mockResolvedValue(opts.claimResult),
    releaseXp: jest.fn().mockResolvedValue(undefined),
  };
  const logger = makeLogger();
  const tracing = new TracingProvider(new TestTracingLogger() as unknown as never);

  const metrics = new MetricsRegistry(logger);

  const service = new XpIngestionService(
    db as never,
    rankingRepository as unknown as RankingRepositoryPort,
    eventBus,
    outbox,
    rankCalculationService,
    versionService as unknown as RankingCacheVersionService,
    dedupe,
    metrics,
    tracing,
    logger,
  );

  return { service, rankingRepository, dedupe, db, metrics, tracing };
}

const baseEvent = {
  eventType: 'external.xp.earned' as const,
  userId: 'u1',
  amount: 50,
  source: 'quiz_attempt' as const,
  idempotencyKey: 'xp:u1:attempt:1',
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
};

describe('XpIngestionService — Redis SETNX dedupe guard', () => {
  it('skips downstream processing when tryClaimXp returns false', async () => {
    const { service, rankingRepository, dedupe, metrics } = makeHarness({ claimResult: false });

    await service.processXpEvent(baseEvent, 'in_proc');

    expect(dedupe.tryClaimXp).toHaveBeenCalledWith('xp:u1:attempt:1', expect.any(Number));
    expect(rankingRepository.updateXpInTx).not.toHaveBeenCalled();
    expect(metrics.xpIngestDuplicateSkipped.values.get('source=in_proc')).toBe(1);
  });

  it('runs downstream processing when tryClaimXp returns true', async () => {
    const { service, rankingRepository, dedupe } = makeHarness({ claimResult: true });

    await service.processXpEvent(baseEvent, 'outbox');

    expect(dedupe.tryClaimXp).toHaveBeenCalledTimes(1);
    expect(rankingRepository.updateXpInTx).toHaveBeenCalledTimes(1);
    expect(dedupe.releaseXp).not.toHaveBeenCalled();
  });

  it('releases the claim when downstream processing throws', async () => {
    const { service, dedupe, db } = makeHarness({ claimResult: true });
    db.transaction.mockRejectedValueOnce(new Error('tx-failed'));

    await expect(service.processXpEvent(baseEvent, 'in_proc')).rejects.toThrow('tx-failed');

    expect(dedupe.releaseXp).toHaveBeenCalledWith('xp:u1:attempt:1');
  });

  it('counts the duplicate with the source label passed in by the caller', async () => {
    const { service, metrics } = makeHarness({ claimResult: false });

    await service.processXpEvent(baseEvent, 'outbox');
    await service.processXpEvent(baseEvent, 'outbox');
    await service.processXpEvent({ ...baseEvent, idempotencyKey: 'xp:u1:attempt:2' }, 'manual');

    expect(metrics.xpIngestDuplicateSkipped.values.get('source=outbox')).toBe(2);
    expect(metrics.xpIngestDuplicateSkipped.values.get('source=manual')).toBe(1);
  });

  it('uses the configured TTL when calling tryClaimXp', async () => {
    const { service, dedupe } = makeHarness({ claimResult: true });

    await service.processXpEvent(baseEvent, 'in_proc');

    const firstCall = dedupe.tryClaimXp.mock.calls[0] as unknown as unknown[] | undefined;
    const ttlArgument: unknown = firstCall === undefined ? undefined : firstCall[1];
    const ttl = typeof ttlArgument === 'number' ? ttlArgument : -1;
    expect(ttl).toBeGreaterThan(86_400);
    expect(ttl).toBeLessThanOrEqual(7 * 86_400);
  });

  it('defaults the source to in_proc when the caller does not pass one', async () => {
    const { service, metrics } = makeHarness({ claimResult: false });

    await service.processXpEvent(baseEvent);

    expect(metrics.xpIngestDuplicateSkipped.values.get('source=in_proc')).toBe(1);
  });

  it('propagates validation errors without consuming a dedupe slot', async () => {
    const { service, dedupe } = makeHarness({ claimResult: true });

    await expect(
      service.processXpEvent({ ...baseEvent, idempotencyKey: '' }, 'in_proc'),
    ).rejects.toThrow();

    expect(dedupe.tryClaimXp).not.toHaveBeenCalled();
    expect(dedupe.releaseXp).not.toHaveBeenCalled();
  });

  it('passes the configured source label downstream to the outbox row', async () => {
    const sources: XpIngestSource[] = ['in_proc', 'outbox', 'manual'];
    for (const source of sources) {
      const { service, dedupe } = makeHarness({ claimResult: false });
      await service.processXpEvent(baseEvent, source);
      expect(dedupe.tryClaimXp).toHaveBeenCalled();
    }
  });
});
