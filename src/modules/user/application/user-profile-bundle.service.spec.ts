/**
 * Unit tests for `UserProfileBundleService` with the Phase 3 #3
 * Redis cache wired in.
 *
 * The cache contract we test:
 *   - First call runs the fetcher and stores the result.
 *   - Second call with the same (userId, locale) returns the
 *     cached value WITHOUT calling the fetcher.
 *   - Different locales for the same user hash to different keys.
 *   - Different users hash to different keys.
 */

import { UserProfileBundleService } from './user-profile-bundle.service';

class InMemoryCache {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttlMs: number): Promise<void> {
    this.store.set(key, value);
  }

  async getOrSetWithStampedeProtection<T>(
    key: string,
    _ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const value = await fetcher();
    await this.set(key, JSON.stringify(value), 1);
    return value;
  }
}

const makeService = (cache: InMemoryCache) => {
  const summary = {
    getSummary: jest.fn().mockResolvedValue({ name: 'Alice' }),
    getAnalytics: jest.fn().mockResolvedValue({ userId: 'u1' }),
    getRecentActivity: jest.fn().mockResolvedValue([]),
  };
  const coin = {
    getWallet: jest.fn().mockResolvedValue({ balance: 100 }),
    listTransactions: jest.fn().mockResolvedValue([]),
    getDailyEarnCapSum: jest.fn().mockResolvedValue(0),
  };

  const service = new UserProfileBundleService(
    summary as never,
    coin as never,
    cache as never,
  );

  return { service, summary, coin };
};

describe('UserProfileBundleService (cached)', () => {
  it('runs the fetcher on the first call and reuses the cache on the second', async () => {
    const cache = new InMemoryCache();
    const { service, summary, coin } = makeService(cache);

    const first = await service.getBundleForCurrentUser('u1', 'en');
    expect(first.summary).toEqual({ name: 'Alice' });
    expect(summary.getSummary).toHaveBeenCalledTimes(1);
    expect(coin.getWallet).toHaveBeenCalledTimes(1);

    const second = await service.getBundleForCurrentUser('u1', 'en');
    expect(second.summary).toEqual({ name: 'Alice' });
    expect(second).toEqual(first);
    expect(summary.getSummary).toHaveBeenCalledTimes(1);
    expect(coin.getWallet).toHaveBeenCalledTimes(1);
  });

  it('produces different cache keys for different locales', async () => {
    const cache = new InMemoryCache();
    const { service, summary } = makeService(cache);

    await service.getBundleForCurrentUser('u1', 'en');
    await service.getBundleForCurrentUser('u1', 'fr');

    // Two distinct fetches → summary called twice (the locale
    // separator isolates the cache).
    expect(summary.getSummary).toHaveBeenCalledTimes(2);
  });

  it('uses the default cache key when no locale is provided', async () => {
    const cache = new InMemoryCache();
    const { service, summary } = makeService(cache);

    await service.getBundleForCurrentUser('u1');
    await service.getBundleForCurrentUser('u1');
    expect(summary.getSummary).toHaveBeenCalledTimes(1);
  });

  it('isolates cache entries between users', async () => {
    const cache = new InMemoryCache();
    const { service, summary } = makeService(cache);

    await service.getBundleForCurrentUser('u1', 'en');
    await service.getBundleForCurrentUser('u2', 'en');
    expect(summary.getSummary).toHaveBeenCalledTimes(2);
  });
});