import type { PinoLogger } from 'nestjs-pino';
import { NotificationCleanupScheduler } from './notification-cleanup.scheduler';
import type { NotificationRepositoryPort } from '../../domain/ports';
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

type LockBehavior = { kind: 'acquired' } | { kind: 'held-by-another' } | { kind: 'circuit-open' };

function makeScheduler(behavior: LockBehavior): {
  service: NotificationCleanupScheduler;
  repo: { deleteExpired: jest.Mock };
} {
  const repo = { deleteExpired: jest.fn().mockResolvedValue(7) };
  const cache = {
    acquireAdvisoryLock: jest.fn().mockImplementation(() => {
      if (behavior.kind === 'acquired') return Promise.resolve('token-x');
      return Promise.resolve(null);
    }),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;
  const circuit = {
    getCircuitState: jest
      .fn()
      .mockImplementation(() => (behavior.kind === 'circuit-open' ? 'open' : 'closed')),
  } as unknown as RedisCircuitPort;
  const service = new NotificationCleanupScheduler(
    repo as unknown as NotificationRepositoryPort,
    cache,
    circuit,
    undefined,
    makeLogger(),
  );
  return { service, repo };
}

describe('NotificationCleanupScheduler — distributed locking', () => {
  it('runs the cron body and releases the lock when acquired', async () => {
    const { service, repo } = makeScheduler({ kind: 'acquired' });
    await service.handleExpiredNotifications();
    expect(repo.deleteExpired).toHaveBeenCalledTimes(1);
  });

  it('skips the cron body when another replica holds the lock', async () => {
    const { service, repo } = makeScheduler({ kind: 'held-by-another' });
    await service.handleExpiredNotifications();
    expect(repo.deleteExpired).not.toHaveBeenCalled();
  });

  it('runs the manual trigger path regardless of the lock — manual triggers are operator-driven and must always succeed', async () => {
    const { service, repo } = makeScheduler({ kind: 'held-by-another' });
    const result = await service.triggerCleanup();
    expect(result).toBe(7);
    expect(repo.deleteExpired).toHaveBeenCalledTimes(1);
  });
});
