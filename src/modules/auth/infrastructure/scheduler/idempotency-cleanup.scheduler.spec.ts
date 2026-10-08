import type { PinoLogger } from 'nestjs-pino';
import { IdempotencyCleanupScheduler } from './idempotency-cleanup.scheduler';
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

function makeService(
  opts: {
    acquired: boolean;
    deletedCount: number;
    deleteFails?: boolean;
  } = { acquired: true, deletedCount: 0 },
): {
  service: IdempotencyCleanupScheduler;
  db: { delete: jest.Mock };
} {
  const db = {
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        then: undefined,
        catch: undefined,
      }),
    }),
  };
  if (!opts.deleteFails) {
    db.delete.mockReturnValue({
      where: jest.fn().mockResolvedValue({ rowCount: opts.deletedCount }),
    });
  } else {
    db.delete.mockReturnValue({
      where: jest.fn().mockRejectedValue(new Error('boom')),
    });
  }
  const cache = {
    acquireAdvisoryLock: jest.fn().mockResolvedValue(opts.acquired ? 'token-1' : null),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;
  const circuit = {
    getCircuitState: jest.fn().mockReturnValue('closed'),
  } as unknown as RedisCircuitPort;
  const service = new IdempotencyCleanupScheduler(
    db as never,
    cache,
    circuit,
    undefined,
    makeLogger(),
  );
  return { service, db };
}

describe('IdempotencyCleanupScheduler — distributed locking', () => {
  it('runs the cleanup and releases the lock when acquired', async () => {
    const { service, db } = makeService({ acquired: true, deletedCount: 3 });
    const result = await service.triggerCleanup();
    expect(result).toBe(3);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it('skips the cleanup when another replica holds the lock', async () => {
    const { service, db } = makeService({ acquired: false, deletedCount: 0 });
    const result = await service.triggerCleanup();
    expect(result).toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('swallows DB errors and returns 0', async () => {
    const { service } = makeService({
      acquired: true,
      deletedCount: 0,
      deleteFails: true,
    });
    const result = await service.triggerCleanup();
    expect(result).toBe(0);
  });
});
