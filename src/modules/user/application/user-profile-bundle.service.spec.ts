import { UserProfileBundleService } from './user-profile-bundle.service';

class InMemoryCache {
  readonly store = new Map<string, string>();
  unlinkByPatternCalls = 0;

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttlMs: number): Promise<void> {
    this.store.set(key, value);
  }

  async unlinkByPattern(pattern: string): Promise<number> {
    this.unlinkByPatternCalls += 1;
    const regex = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    const matching = Array.from(this.store.keys()).filter((k) => regex.test(k));
    for (const k of matching) {
      this.store.delete(k);
    }
    return matching.length;
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

  const service = new UserProfileBundleService(summary as never, coin as never, cache as never);

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

describe('UserProfileBundleService — event-driven invalidation', () => {
  it('subscribes on init and unsubscribes on destroy', () => {
    const cache = new InMemoryCache();
    const unsubscribe = jest.fn();
    const subscribe = jest.fn().mockReturnValue(unsubscribe);
    const service = new UserProfileBundleService(
      {} as never,
      {} as never,
      cache as never,
      { subscribe } as never,
    );

    service.onModuleInit();
    expect(subscribe).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    service.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache for the user that emitted a profile event', async () => {
    const cache = new InMemoryCache();
    await cache.set(
      'user:profile-bundle:v1:u1:en-12345678',
      JSON.stringify({ name: 'old' }),
      120_000,
    );
    await cache.set(
      'user:profile-bundle:v1:u1:default',
      JSON.stringify({ name: 'old-default' }),
      120_000,
    );
    await cache.set(
      'user:profile-bundle:v1:u2:en-12345678',
      JSON.stringify({ name: 'other' }),
      120_000,
    );

    let capturedHandler: ((event: unknown) => void) | null = null;
    const subscribe = jest.fn().mockImplementation((handler: (event: unknown) => void) => {
      capturedHandler = handler;
      return () => undefined;
    });

    const service = new UserProfileBundleService(
      {} as never,
      {} as never,
      cache as never,
      { subscribe } as never,
    );
    service.onModuleInit();

    expect(capturedHandler).not.toBeNull();
    capturedHandler!({ userId: 'u1', nowIso: new Date().toISOString() });

    await new Promise((resolve) => setImmediate(resolve));

    expect(cache.store.has('user:profile-bundle:v1:u1:en-12345678')).toBe(false);
    expect(cache.store.has('user:profile-bundle:v1:u1:default')).toBe(false);
    expect(cache.store.has('user:profile-bundle:v1:u2:en-12345678')).toBe(true);
  });

  it('ignores events without a string userId', async () => {
    const cache = new InMemoryCache();
    let capturedHandler: ((event: unknown) => void) | null = null;
    const subscribe = jest.fn().mockImplementation((handler: (event: unknown) => void) => {
      capturedHandler = handler;
      return () => undefined;
    });

    const service = new UserProfileBundleService(
      {} as never,
      {} as never,
      cache as never,
      { subscribe } as never,
    );
    service.onModuleInit();

    capturedHandler!({});
    capturedHandler!({ userId: 123 });
    capturedHandler!(null);

    await new Promise((resolve) => setImmediate(resolve));
    expect(cache.unlinkByPatternCalls).toBe(0);
  });

  it('does not throw when the event bus is absent', () => {
    const cache = new InMemoryCache();
    const service = new UserProfileBundleService(
      {} as never,
      {} as never,
      cache as never,
      undefined,
    );
    expect(() => service.onModuleInit()).not.toThrow();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});
