import type { CacheProvider } from '@/common/ports/cache.provider';
import { RankingCacheVersionService } from './ranking-cache-version.service';
import { RankingPeriod } from '../types/ranking.types';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
}

interface _CacheFake extends CacheProvider {
  store: Map<string, string>;
}

function makeCache(): jest.Mocked<CacheProvider> & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const cache = {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    del: jest.fn(),
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
    incrementCounterWithInitialTtlSeconds: jest.fn().mockResolvedValue(1),
    setIfNotExistsWithTtlSeconds: jest.fn(),
    listLength: jest.fn(),
    pipelineDeadLetterPush: jest.fn(),
    multiExec: jest.fn(),
  } as unknown as jest.Mocked<CacheProvider> & { store: Map<string, string> };
  return cache;
}

describe('RankingCacheVersionService', () => {
  it('versionKeyFor returns a period-specific key', () => {
    const service = new RankingCacheVersionService(makeCache(), makeLogger());
    expect(service.versionKeyFor(RankingPeriod.WEEKLY)).toBe('ranking:version:weekly');
  });

  it('getVersion defaults to 0 when the key is missing', async () => {
    const service = new RankingCacheVersionService(makeCache(), makeLogger());
    await expect(service.getVersion(RankingPeriod.WEEKLY)).resolves.toBe(0);
  });

  it('getVersion parses the stored numeric value', async () => {
    const cache = makeCache();
    cache.store.set('ranking:version:weekly', '12');
    const service = new RankingCacheVersionService(cache, makeLogger());
    await expect(service.getVersion(RankingPeriod.WEEKLY)).resolves.toBe(12);
  });

  it('getVersion falls back to 0 on cache failure', async () => {
    const cache = makeCache();
    (cache.get as jest.Mock).mockRejectedValueOnce(new Error('redis down'));
    const service = new RankingCacheVersionService(cache, makeLogger());
    await expect(service.getVersion(RankingPeriod.WEEKLY)).resolves.toBe(0);
  });

  it('bumpVersion uses single Lua round-trip (counter + initial TTL)', async () => {
    const cache = makeCache();
    cache.incrementCounterWithInitialTtlSeconds.mockResolvedValueOnce(8);
    const service = new RankingCacheVersionService(cache, makeLogger());
    await service.bumpVersion(RankingPeriod.WEEKLY);
    expect(cache.incrementCounterWithInitialTtlSeconds).toHaveBeenCalledWith(
      'ranking:version:weekly',
      expect.any(Number),
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('bumpVersion from a missing key writes 1', async () => {
    const cache = makeCache();
    cache.incrementCounterWithInitialTtlSeconds.mockResolvedValueOnce(1);
    const service = new RankingCacheVersionService(cache, makeLogger());
    await service.bumpVersion(RankingPeriod.ALL_TIME);
    expect(cache.incrementCounterWithInitialTtlSeconds).toHaveBeenCalledTimes(1);
  });

  it('bumpVersion swallows cache failures', async () => {
    const cache = makeCache();
    cache.incrementCounterWithInitialTtlSeconds.mockRejectedValueOnce(new Error('redis down'));
    const service = new RankingCacheVersionService(cache, makeLogger());
    await expect(service.bumpVersion(RankingPeriod.WEEKLY)).resolves.toBeUndefined();
  });

  it('bumpAllPeriods bumps every period in parallel', async () => {
    const cache = makeCache();
    cache.incrementCounterWithInitialTtlSeconds.mockResolvedValue(1);
    const service = new RankingCacheVersionService(cache, makeLogger());
    await service.bumpAllPeriods();
    expect(cache.incrementCounterWithInitialTtlSeconds).toHaveBeenCalledTimes(4);
  });
});
