import type { PinoLogger } from 'nestjs-pino';
import type { CacheProvider } from '@/common/ports/cache.provider';
import { NotificationRepository } from './notification.repository';
import type { DrizzleDB } from '@/core/database/database.module';

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

function makeCache(): CacheProvider {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(true),
    getDel: jest.fn(),
    unlinkByPattern: jest.fn(),
    acquireAdvisoryLock: jest.fn(),
    releaseAdvisoryLock: jest.fn(),
    getOrSet: jest.fn(),
    getOrSetWithStampedeProtection: jest.fn(),
    rpushJson: jest.fn(),
    lpopJson: jest.fn(),
    lrangeJson: jest.fn(),
    trimList: jest.fn(),
    expire: jest.fn(),
    zaddByScore: jest.fn(),
    zrangeByScore: jest.fn(),
    zrem: jest.fn(),
    incrementWindowCounter: jest.fn(),
    incrementCounterWithInitialTtlSeconds: jest.fn(),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    listLength: jest.fn(),
    pipelineDeadLetterPush: jest.fn(),
  } as unknown as CacheProvider;
}

describe('NotificationRepository — analytics cache invalidation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces invalidation calls within the window', async () => {
    const cache = makeCache();
    const repo = new NotificationRepository({} as DrizzleDB, undefined, cache, makeLogger());
    await repo.invalidateAnalyticsCache();
    await repo.invalidateAnalyticsCache();
    await repo.invalidateAnalyticsCache();
    expect(cache.del).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    expect(cache.del).toHaveBeenCalledWith('notif:analytics:platform');
    expect(cache.del).toHaveBeenCalledTimes(1);
  });

  it('flushes pending invalidation on module destroy', async () => {
    const cache = makeCache();
    const repo = new NotificationRepository({} as DrizzleDB, undefined, cache, makeLogger());
    await repo.invalidateAnalyticsCache();
    repo.onModuleDestroy();
    await Promise.resolve();
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('invalidateAnalyticsCache is a no-op when the cache is absent', async () => {
    const repo = new NotificationRepository({} as DrizzleDB, undefined, undefined, makeLogger());
    await expect(repo.invalidateAnalyticsCache()).resolves.toBeUndefined();
  });
});
