import type { PinoLogger } from 'nestjs-pino';
import { ReviewOutboxSchedulerService } from './review-outbox.scheduler';
import type { ReviewOutboxProcessorService } from './review-outbox-processor.service';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { RedisCircuitPort } from '@/common/ports/redis-circuit.port';

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

type LockBehavior = { kind: 'acquired' } | { kind: 'held-by-another' };

function makeScheduler(behavior: LockBehavior): {
  service: ReviewOutboxSchedulerService;
  processor: { processPendingEvents: jest.Mock };
} {
  const processor = {
    processPendingEvents: jest.fn().mockResolvedValue({ processed: 0, failed: 0 }),
  };
  const cache = {
    acquireAdvisoryLock: jest.fn().mockImplementation(() => {
      if (behavior.kind === 'acquired') return Promise.resolve('token-x');
      return Promise.resolve(null);
    }),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;
  const circuit = {
    getCircuitState: jest.fn().mockReturnValue('closed'),
  } as unknown as RedisCircuitPort;
  const service = new ReviewOutboxSchedulerService(
    processor as unknown as ReviewOutboxProcessorService,
    cache,
    circuit,
    undefined,
    makeLogger(),
  );
  return { service, processor };
}

describe('ReviewOutboxSchedulerService — distributed locking', () => {
  it('runs the tick when the lock is acquired', async () => {
    const { service, processor } = makeScheduler({ kind: 'acquired' });
    await service.handleOutboxTick();
    expect(processor.processPendingEvents).toHaveBeenCalledTimes(1);
  });

  it('skips the tick when another replica holds the lock', async () => {
    const { service, processor } = makeScheduler({ kind: 'held-by-another' });
    await service.handleOutboxTick();
    expect(processor.processPendingEvents).not.toHaveBeenCalled();
  });

  it('does not crash when processor throws and the lock is released', async () => {
    const { service, processor } = makeScheduler({ kind: 'acquired' });
    processor.processPendingEvents.mockRejectedValueOnce(new Error('boom'));
    await expect(service.handleOutboxTick()).resolves.not.toThrow();
  });
});
