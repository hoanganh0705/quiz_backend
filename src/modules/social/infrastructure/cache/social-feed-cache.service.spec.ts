import type { CacheProvider } from '@/common/ports/cache.provider';
import { SocialFeedCache } from './social-feed-cache.service';

class InMemoryCache {
  readonly store = new Map<string, string>();
  private now = 0;
  private readonly ttlByKey = new Map<string, number>();

  setNow(t: number): void {
    this.now = t;
  }

  async get(key: string): Promise<string | null> {
    const ttl = this.ttlByKey.get(key);
    if (ttl !== undefined && this.now >= ttl) {
      this.store.delete(key);
      this.ttlByKey.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, value);
    this.ttlByKey.set(key, this.now + ttlMs);
  }

  async del(key: string): Promise<boolean> {
    const existed = this.store.delete(key);
    this.ttlByKey.delete(key);
    return existed;
  }

  async unlinkByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    const matching = Array.from(this.store.keys()).filter((k) => regex.test(k));
    for (const k of matching) {
      this.store.delete(k);
      this.ttlByKey.delete(k);
    }
    return matching.length;
  }

  async getOrSetWithStampedeProtection<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const value = await fetcher();
    await this.set(key, JSON.stringify(value), ttlMs);
    return value;
  }
}

describe('SocialFeedCache', () => {
  let cache: InMemoryCache;
  let service: SocialFeedCache;

  const feedData = { items: [{ type: 'friend', userId: 'u1' }] };

  beforeEach(() => {
    cache = new InMemoryCache();
    service = new SocialFeedCache(
      cache as unknown as CacheProvider,
      {
        warn: () => undefined,
        info: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      } as never,
    );
  });

  describe('getOrSetFeed', () => {
    it('caches feed data for a user', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(feedData);
      const result = await service.getOrSetFeed('user-1', 'v1', fetcher);

      expect(result).toStrictEqual(feedData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on subsequent calls', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(feedData);
      await service.getOrSetFeed('user-1', 'v1', fetcher);

      const secondFetcher = jest.fn();
      const cached = await service.getOrSetFeed('user-1', 'v1', secondFetcher);

      expect(secondFetcher).not.toHaveBeenCalled();
      expect(cached).toStrictEqual(feedData);
    });

    it('different versionHash produces different cache entry', async () => {
      cache.setNow(0);

      await service.getOrSetFeed('user-1', 'v1', async () => ({ version: 1 }));
      await service.getOrSetFeed('user-1', 'v2', async () => ({ version: 2 }));

      const fetcher = jest.fn();
      const cached1 = await service.getOrSetFeed('user-1', 'v1', fetcher);
      expect(cached1).toEqual({ version: 1 });

      const cached2 = await service.getOrSetFeed('user-1', 'v2', fetcher);
      expect(cached2).toEqual({ version: 2 });
    });

    it('different users have separate cache entries', async () => {
      cache.setNow(0);

      await service.getOrSetFeed('user-1', 'v1', async () => ({ userId: 'user-1' }));
      await service.getOrSetFeed('user-2', 'v1', async () => ({ userId: 'user-2' }));

      const cached1 = await service.getOrSetFeed('user-1', 'v1', jest.fn());
      const cached2 = await service.getOrSetFeed('user-2', 'v1', jest.fn());

      expect(cached1).toEqual({ userId: 'user-1' });
      expect(cached2).toEqual({ userId: 'user-2' });
    });
  });

  describe('invalidateFeed', () => {
    it('clears the feed cache for a user', async () => {
      cache.setNow(0);
      await service.getOrSetFeed('user-1', 'v1', async () => feedData);

      await service.invalidateFeed('user-1');

      const fetcher = jest.fn().mockResolvedValue({ items: [] });
      const result = await service.getOrSetFeed('user-1', 'v1', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [] });
    });

    it('invalidating one user does not affect another user', async () => {
      cache.setNow(0);
      await service.getOrSetFeed('user-1', 'v1', async () => ({ data: 'user-1' }));
      await service.getOrSetFeed('user-2', 'v1', async () => ({ data: 'user-2' }));

      await service.invalidateFeed('user-1');

      const fetcher1 = jest.fn();
      const fetcher2 = jest.fn();

      await service.getOrSetFeed('user-1', 'v1', fetcher1);
      await service.getOrSetFeed('user-2', 'v1', fetcher2);

      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(fetcher2).not.toHaveBeenCalled();
    });
  });
});
