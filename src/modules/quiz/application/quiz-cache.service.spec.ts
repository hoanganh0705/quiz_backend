/**
 * Unit tests for `QuizCacheService`.
 *
 * We exercise the three caching surfaces against an in-memory
 * `CacheProvider` stub. The tests cover:
 *   - cache miss → fetcher runs and the result is cached
 *   - cache hit → fetcher does NOT run
 *   - cache key determinism (same filters → same key)
 *   - per-namespace invalidation (one key does not evict another)
 *   - stats and profile-bundle helpers reuse the underlying
 *     stampede-protected getOrSet
 */

import { QuizCacheService } from './quiz-cache.service';
import type { CacheProvider } from '@/common/ports/cache.provider';

class InMemoryCache implements CacheProvider {
  readonly store = new Map<string, string>();
  private now = 0;
  private readonly ttlByKey = new Map<string, number>();

  setNow(t: number): void {
    this.now = t;
  }

  async incrementWindowCounter(): Promise<number> {
    return 0;
  }

  async setIfNotExistsWithTtlSeconds(): Promise<boolean> {
    return true;
  }

  async incrementCounterWithInitialTtlSeconds(): Promise<number> {
    return 0;
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

  async getDel(key: string): Promise<string | null> {
    const value = await this.get(key);
    if (value !== null) {
      await this.del(key);
    }
    return value;
  }

  async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const value = await fetcher();
    await this.set(key, JSON.stringify(value), ttlMs);
    return value;
  }

  async getOrSetWithStampedeProtection<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    // Single-flight lock semantics are exercised at the
    // `RedisService` level; here we only test the read-through
    // contract.
    return this.getOrSet(key, ttlMs, fetcher);
  }

  async rpushJson(): Promise<number> {
    return 0;
  }

  async lpopJson<T>(): Promise<T | null> {
    return null;
  }

  async acquireAdvisoryLock(): Promise<boolean> {
    return true;
  }

  async releaseAdvisoryLock(): Promise<boolean> {
    return true;
  }
}

describe('QuizCacheService', () => {
  let cache: InMemoryCache;
  let service: QuizCacheService;

  beforeEach(() => {
    cache = new InMemoryCache();
    service = new QuizCacheService(cache as unknown as CacheProvider, {
      warn: () => undefined,
      info: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    } as never);
  });

  describe('list cache', () => {
    it('builds a deterministic key for the same filter tuple', () => {
      const filters = { difficulty: 'easy', categoryId: 'c1', tagIds: ['a', 'b'] };
      const keyA = service.buildListCacheKey({ filters, cursor: null, limit: 20 });
      const keyB = service.buildListCacheKey({ filters, cursor: null, limit: 20 });
      expect(keyA).toBe(keyB);
    });

    it('produces different keys when the filter tuple differs', () => {
      const keyA = service.buildListCacheKey({
        filters: { difficulty: 'easy' },
        cursor: null,
        limit: 20,
      });
      const keyB = service.buildListCacheKey({
        filters: { difficulty: 'hard' },
        cursor: null,
        limit: 20,
      });
      expect(keyA).not.toBe(keyB);
    });

    it('normalizes filter key order so different orderings collide', () => {
      const keyA = service.buildListCacheKey({
        filters: { difficulty: 'easy', categoryId: 'c1' },
        cursor: null,
        limit: 20,
      });
      const keyB = service.buildListCacheKey({
        filters: { categoryId: 'c1', difficulty: 'easy' },
        cursor: null,
        limit: 20,
      });
      expect(keyA).toBe(keyB);
    });

    it('runs the fetcher on cache miss', async () => {
      const fetcher = jest.fn().mockResolvedValue({ items: [] });
      const result = await service.getOrSetList('quiz:list:v1:abc', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [] });
    });

    it('does not run the fetcher on cache hit', async () => {
      // Pre-populate the cache.
      cache.setNow(0);
      await service.getOrSetList('quiz:list:v1:abc', async () => ({ items: [] }));
      cache.setNow(1_000);

      const fetcher = jest.fn().mockResolvedValue({ items: ['fresh'] });
      const result = await service.getOrSetList('quiz:list:v1:abc', fetcher);
      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [] });
    });

    it('expires after the TTL', async () => {
      cache.setNow(0);
      await service.getOrSetList('quiz:list:v1:abc', async () => ({ items: ['first'] }));
      // Advance past the 60s TTL.
      cache.setNow(70_000);

      const fetcher = jest.fn().mockResolvedValue({ items: ['second'] });
      const result = await service.getOrSetList('quiz:list:v1:abc', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: ['second'] });
    });
  });

  describe('stats cache', () => {
    it('caches by quizId and evicts on invalidate', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue({ views: 10 });
      const first = await service.getOrSetStats('quiz-1', fetcher);
      expect(first).toEqual({ views: 10 });

      cache.setNow(1_000);
      const fetcher2 = jest.fn().mockResolvedValue({ views: 20 });
      const cached = await service.getOrSetStats('quiz-1', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(cached).toEqual({ views: 10 });

      await service.invalidateStats('quiz-1');
      const fetcher3 = jest.fn().mockResolvedValue({ views: 30 });
      const fresh = await service.getOrSetStats('quiz-1', fetcher3);
      expect(fetcher3).toHaveBeenCalledTimes(1);
      expect(fresh).toEqual({ views: 30 });
    });

    it('invalidating one quiz does not affect another', async () => {
      cache.setNow(0);
      await service.getOrSetStats('quiz-1', async () => ({ views: 1 }));
      await service.getOrSetStats('quiz-2', async () => ({ views: 2 }));
      await service.invalidateStats('quiz-1');

      const fetcher2 = jest.fn().mockResolvedValue({ views: 99 });
      const result = await service.getOrSetStats('quiz-2', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(result).toEqual({ views: 2 });
    });
  });

  describe('profile-bundle cache', () => {
    it('caches per userId', async () => {
      cache.setNow(0);
      const fetcher = jest.fn().mockResolvedValue({ name: 'Alice' });
      const first = await service.getOrSetProfileBundle('user-1', fetcher);
      expect(first).toEqual({ name: 'Alice' });

      cache.setNow(1_000);
      const fetcher2 = jest.fn().mockResolvedValue({ name: 'Bob' });
      const cached = await service.getOrSetProfileBundle('user-1', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(cached).toEqual({ name: 'Alice' });
    });

    it('invalidates per user', async () => {
      cache.setNow(0);
      await service.getOrSetProfileBundle('user-1', async () => ({ name: 'A' }));
      await service.getOrSetProfileBundle('user-2', async () => ({ name: 'B' }));
      await service.invalidateProfileBundle('user-1');

      const fetcher1 = jest.fn().mockResolvedValue({ name: 'A2' });
      await service.getOrSetProfileBundle('user-1', fetcher1);
      expect(fetcher1).toHaveBeenCalledTimes(1);

      const fetcher2 = jest.fn().mockResolvedValue({ name: 'B2' });
      const cached = await service.getOrSetProfileBundle('user-2', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(cached).toEqual({ name: 'B' });
    });
  });
});