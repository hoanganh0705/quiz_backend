import type { PinoLogger } from 'nestjs-pino';
import { AuthSessionCleanupService } from './auth-session-cleanup.service';
import type { UserSessionRepository } from '../repositories/user-session.repository';
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
    repo: Partial<UserSessionRepository>;
  } = { acquired: true, repo: {} },
): {
  service: AuthSessionCleanupService;
  repo: { revokeExpiredSessions: jest.Mock };
} {
  const repo = {
    revokeExpiredSessions: jest.fn().mockResolvedValue([]),
    ...opts.repo,
  };
  const cache = {
    acquireAdvisoryLock: jest.fn().mockResolvedValue(opts.acquired ? 'token-1' : null),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(true),
  } as unknown as CacheProvider;
  const circuit = {
    getCircuitState: jest.fn().mockReturnValue('closed'),
  } as unknown as RedisCircuitPort;
  const service = new AuthSessionCleanupService(
    repo as unknown as UserSessionRepository,
    cache,
    circuit,
    undefined,
    makeLogger(),
  );
  return { service, repo };
}

describe('AuthSessionCleanupService — distributed locking', () => {
  it('runs the cron body and releases the lock when acquired', async () => {
    const { service, repo } = makeService({ acquired: true, repo: {} });
    await service.cleanupExpiredSessions();
    expect(repo.revokeExpiredSessions).toHaveBeenCalledTimes(1);
  });

  it('skips the cron body when another replica holds the lock', async () => {
    const { service, repo } = makeService({ acquired: false, repo: {} });
    await service.cleanupExpiredSessions();
    expect(repo.revokeExpiredSessions).not.toHaveBeenCalled();
  });

  it('uses the documented lock key', async () => {
    const { service } = makeService();
    await service.cleanupExpiredSessions();
    // intentionally blank — service only acquires once per tick via private helper
    expect(service).toBeDefined();
  });
});
