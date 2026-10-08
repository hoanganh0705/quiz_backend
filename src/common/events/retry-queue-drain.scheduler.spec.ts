import type { PinoLogger } from 'nestjs-pino';
import { RetryQueueDrainScheduler } from './retry-queue-drain.scheduler';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import type { RetryQueueMetrics } from '@/core/redis/retry-queue.metrics';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';

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

type LockBehavior = { kind: 'acquired' } | { kind: 'held-by-another' } | { kind: 'circuit-open' };

interface FakeState {
  service: RetryQueueDrainScheduler;
  cache: {
    acquireAdvisoryLock: jest.Mock;
    releaseAdvisoryLock: jest.Mock;
    lpopJson: jest.Mock;
  };
  db: {
    insert: jest.Mock;
  };
  retryQueueMetrics: { getDlqSize: jest.Mock };
  metrics: {
    setRetryQueueDlqSize: jest.Mock;
  };
}

function makeService(
  behavior: LockBehavior,
  opts: {
    listSizes: Record<string, number>;
    envelopes?: Array<{ event: unknown; failedAt: string; lastAttempt: number; lastError: string }>;
  } = { listSizes: { attempt: 0, coin: 0, comment: 0 } },
): FakeState {
  const lockTtl = { acquired: 'tok' };
  void lockTtl;

  const cache = {
    acquireAdvisoryLock: jest.fn().mockImplementation(() => {
      if (behavior.kind === 'acquired') return Promise.resolve('token-x');
      return Promise.resolve(null);
    }),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
    lpopJson: jest.fn().mockImplementation(() => {
      const queue = (opts.envelopes ?? []).shift();
      return Promise.resolve(queue ?? null);
    }),
  } as unknown as CacheProvider & {
    acquireAdvisoryLock: jest.Mock;
    releaseAdvisoryLock: jest.Mock;
    lpopJson: jest.Mock;
  };
  const circuit = {
    getCircuitState: jest
      .fn()
      .mockImplementation(() => (behavior.kind === 'circuit-open' ? 'open' : 'closed')),
  } as unknown as RedisCircuitPort;

  const db = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  };

  const retryQueueMetrics = {
    getDlqSize: jest
      .fn()
      .mockImplementation((tier: string) => Promise.resolve(opts.listSizes[tier] ?? 0)),
  } as unknown as RetryQueueMetrics & { getDlqSize: jest.Mock };

  const metrics = {
    setRetryQueueDlqSize: jest.fn(),
    incSchedulerSkipped: jest.fn(),
  } as unknown as MetricsRegistry & { setRetryQueueDlqSize: jest.Mock };

  const service = new RetryQueueDrainScheduler(
    db as never,
    cache,
    circuit,
    retryQueueMetrics,
    metrics,
    makeLogger(),
  );

  return {
    service,
    cache: cache,
    db,
    retryQueueMetrics,
    metrics,
  };
}

describe('RetryQueueDrainScheduler', () => {
  it('skips the cron tick when another replica holds the lock', async () => {
    const { service, db } = makeService({ kind: 'held-by-another' });
    await service.handleDrain();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('drains and persists envelopes when the lock is acquired', async () => {
    const envelopes = [
      {
        event: { type: 'attempt', id: 1 },
        failedAt: '2026-01-01T00:00:00.000Z',
        lastAttempt: 5,
        lastError: 'boom',
        correlationId: 'corr-1',
      },
      {
        event: { type: 'attempt', id: 2 },
        failedAt: '2026-01-01T00:01:00.000Z',
        lastAttempt: 4,
        lastError: 'still bad',
        correlationId: 'corr-2',
      },
    ];
    const { service, db, cache, metrics } = makeService(
      { kind: 'acquired' },
      {
        listSizes: { attempt: 2, coin: 0, comment: 0 },
        envelopes,
      },
    );
    await service.handleDrain();
    expect(cache.lpopJson).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(metrics.setRetryQueueDlqSize).toHaveBeenCalledWith('attempt', 2);
    expect(metrics.setRetryQueueDlqSize).toHaveBeenCalledWith('coin', 0);
    expect(metrics.setRetryQueueDlqSize).toHaveBeenCalledWith('comment', 0);
  });

  it('does not crash when persistence fails for a single envelope', async () => {
    const { service, db } = makeService(
      { kind: 'acquired' },
      {
        listSizes: { attempt: 1, coin: 0, comment: 0 },
        envelopes: [
          {
            event: { id: 'x' },
            failedAt: '2026-01-01T00:00:00.000Z',
            lastAttempt: 3,
            lastError: 'first failure',
          },
        ],
      },
    );
    db.insert.mockReturnValueOnce({
      values: jest.fn().mockRejectedValueOnce(new Error('db down')),
    });
    db.insert.mockReturnValueOnce({
      values: jest.fn().mockResolvedValueOnce(undefined),
    });
    // Re-prime with two envelopes so the loop continues after the
    // first persist error.
    (service as unknown as { cache: { lpopJson: jest.Mock } }).cache.lpopJson = jest
      .fn()
      .mockResolvedValueOnce({
        event: { id: 'x' },
        failedAt: '2026-01-01T00:00:00.000Z',
        lastAttempt: 3,
        lastError: 'first failure',
      })
      .mockResolvedValueOnce(null);

    await expect(service.handleDrain()).resolves.not.toThrow();
  });

  it('reads per-tier DLQ sizes on demand', async () => {
    const { service, retryQueueMetrics } = makeService(
      {
        kind: 'acquired',
      },
      {
        listSizes: { attempt: 5, coin: 0, comment: 12 },
      },
    );
    const sizes = await service.readTierSizes();
    expect(sizes).toEqual({ attempt: 5, coin: 0, comment: 12 });
    expect(retryQueueMetrics.getDlqSize).toHaveBeenCalledTimes(3);
  });
});
