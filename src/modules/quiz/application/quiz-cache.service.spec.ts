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

import { QuizCacheService, QUIZ_LIST_CACHE_TTL_MS } from './quiz-cache.service';
import type { CacheProvider } from '@/common/ports/cache.provider';

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
    return this.getOrSet(key, ttlMs, fetcher);
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
}

describe('QuizCacheService', () => {
  let cache: InMemoryCache;
  let service: QuizCacheService;

  beforeEach(() => {
    cache = new InMemoryCache();
    service = new QuizCacheService(
      cache as unknown as CacheProvider,
      {
        warn: () => undefined,
        info: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      } as never,
    );
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
      cache.setNow(QUIZ_LIST_CACHE_TTL_MS + 1_000);

      const fetcher = jest.fn().mockResolvedValue({ items: ['second'] });
      const result = await service.getOrSetList('quiz:list:v1:abc', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: ['second'] });
    });

    it('invalidateList wipes every list key under the namespace', async () => {
      cache.setNow(0);
      await service.getOrSetList('quiz:list:v1:a', async () => ({ items: [1] }));
      await service.getOrSetList('quiz:list:v1:b', async () => ({ items: [2] }));
      // A key in a different namespace must survive.
      await service.getOrSetStats('quiz-1', async () => ({ views: 5 }));

      await service.invalidateList();

      const fetcherA = jest.fn().mockResolvedValue({ items: ['fresh-a'] });
      await expect(service.getOrSetList('quiz:list:v1:a', fetcherA)).resolves.toEqual({
        items: ['fresh-a'],
      });
      expect(fetcherA).toHaveBeenCalledTimes(1);

      const fetcherB = jest.fn().mockResolvedValue({ items: ['fresh-b'] });
      await expect(service.getOrSetList('quiz:list:v1:b', fetcherB)).resolves.toEqual({
        items: ['fresh-b'],
      });
      expect(fetcherB).toHaveBeenCalledTimes(1);

      const statsFetcher = jest.fn().mockResolvedValue({ views: 99 });
      await expect(service.getOrSetStats('quiz-1', statsFetcher)).resolves.toEqual({ views: 5 });
      expect(statsFetcher).not.toHaveBeenCalled();
    });

    it('invalidateList leaves no list keys behind', async () => {
      cache.setNow(0);
      await service.getOrSetList('quiz:list:v1:one', async () => ({ items: [1] }));
      await service.getOrSetList('quiz:list:v1:two', async () => ({ items: [2] }));

      await service.invalidateList();

      const allKeys = Array.from(cache.store.keys());
      const listKeys = allKeys.filter((k) => k.startsWith('quiz:list:v1:'));
      expect(listKeys).toEqual([]);
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

  describe('single quiz cache', () => {
    const _QUIZ_CACHE_TTL_MS = 15 * 60 * 1000;

    it('caches by quizId and versionHash', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue({ title: 'Quiz A' });
      const first = await service.getOrSetQuiz('quiz-1', 'vhash1', fetcher);
      expect(first).toEqual({ title: 'Quiz A' });
      expect(fetcher).toHaveBeenCalledTimes(1);

      const fetcher2 = jest.fn().mockResolvedValue({ title: 'Quiz B' });
      const cached = await service.getOrSetQuiz('quiz-1', 'vhash1', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(cached).toEqual({ title: 'Quiz A' });
    });

    it('invalidates specific quiz cache by id', async () => {
      cache.setNow(0);
      await service.getOrSetQuiz('quiz-1', 'vhash1', async () => ({ title: 'Quiz 1' }));
      await service.getOrSetQuiz('quiz-2', 'vhash1', async () => ({ title: 'Quiz 2' }));

      await service.invalidateQuiz('quiz-1');

      const fetcher1 = jest.fn().mockResolvedValue({ title: 'Quiz 1 fresh' });
      const result1 = await service.getOrSetQuiz('quiz-1', 'vhash1', fetcher1);
      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ title: 'Quiz 1 fresh' });

      const fetcher2 = jest.fn().mockResolvedValue({ title: 'Quiz 2 fresh' });
      const result2 = await service.getOrSetQuiz('quiz-2', 'vhash1', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(result2).toEqual({ title: 'Quiz 2' });
    });

    it('different versionHash produces different cache entry', async () => {
      cache.setNow(0);

      await service.getOrSetQuiz('quiz-1', 'vhash1', async () => ({ version: 1 }));
      await service.getOrSetQuiz('quiz-1', 'vhash2', async () => ({ version: 2 }));

      const fetcher = jest.fn();
      const cached1 = await service.getOrSetQuiz('quiz-1', 'vhash1', fetcher);
      expect(cached1).toEqual({ version: 1 });

      const cached2 = await service.getOrSetQuiz('quiz-1', 'vhash2', fetcher);
      expect(cached2).toEqual({ version: 2 });
    });
  });

  describe('trending cache', () => {
    const _TRENDING_CACHE_TTL_MS = 10 * 60 * 1000;

    it('caches trending quizzes', async () => {
      cache.setNow(0);
      const trending = [{ quizId: 'q1', title: 'Trending Quiz' }];

      const fetcher = jest.fn().mockResolvedValue(trending);
      const result = await service.getOrSetTrending(fetcher);

      expect(result).toStrictEqual(trending);
      expect(fetcher).toHaveBeenCalledTimes(1);

      const cachedResult = await service.getOrSetTrending(jest.fn());
      expect(cachedResult).toStrictEqual(trending);
    });

    it('invalidateTrending clears the cache', async () => {
      cache.setNow(0);
      await service.getOrSetTrending(async () => [{ quizId: 'q1' }]);

      await service.invalidateTrending();

      const fetcher = jest.fn().mockResolvedValue([{ quizId: 'q2' }]);
      const result = await service.getOrSetTrending(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ quizId: 'q2' }]);
    });
  });

  describe('popular cache', () => {
    it('caches popular quizzes', async () => {
      cache.setNow(0);
      const popular = [{ quizId: 'q1', title: 'Popular Quiz' }];

      const fetcher = jest.fn().mockResolvedValue(popular);
      const result = await service.getOrSetPopular(fetcher);

      expect(result).toStrictEqual(popular);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('invalidatePopular clears the cache', async () => {
      cache.setNow(0);
      await service.getOrSetPopular(async () => [{ quizId: 'q1' }]);

      await service.invalidatePopular();

      const fetcher = jest.fn().mockResolvedValue([{ quizId: 'q2' }]);
      const result = await service.getOrSetPopular(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ quizId: 'q2' }]);
    });
  });

  describe('featured cache', () => {
    const _FEATURED_CACHE_TTL_MS = 30 * 60 * 1000;

    it('caches featured quizzes with 30 min TTL', async () => {
      cache.setNow(0);
      const featured = [{ quizId: 'q1', title: 'Featured Quiz' }];

      const fetcher = jest.fn().mockResolvedValue(featured);
      const result = await service.getOrSetFeatured(fetcher);

      expect(result).toStrictEqual(featured);
      expect(fetcher).toHaveBeenCalledTimes(1);

      cache.setNow(15 * 60 * 1000);
      const cached = await service.getOrSetFeatured(jest.fn());
      expect(cached).toStrictEqual(featured);
    });

    it('expires after 30 min TTL', async () => {
      cache.setNow(0);
      await service.getOrSetFeatured(async () => [{ quizId: 'q1' }]);

      cache.setNow(31 * 60 * 1000);

      const fetcher = jest.fn().mockResolvedValue([{ quizId: 'q2' }]);
      const result = await service.getOrSetFeatured(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ quizId: 'q2' }]);
    });

    it('invalidateFeatured clears the cache', async () => {
      cache.setNow(0);
      await service.getOrSetFeatured(async () => [{ quizId: 'q1' }]);

      await service.invalidateFeatured();

      const fetcher = jest.fn().mockResolvedValue([{ quizId: 'q2' }]);
      const result = await service.getOrSetFeatured(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ quizId: 'q2' }]);
    });
  });

  describe('aggregate cache', () => {
    const _AGGREGATE_CACHE_TTL_MS = 5 * 60 * 1000;

    it('caches by quizId and versionHash', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue({ quiz: { title: 'Quiz A' }, stats: {} });
      const first = await service.getOrSetAggregate('quiz-1', 'vhash1', fetcher);
      expect(first).toEqual({ quiz: { title: 'Quiz A' }, stats: {} });
      expect(fetcher).toHaveBeenCalledTimes(1);

      const fetcher2 = jest.fn().mockResolvedValue({ quiz: { title: 'Quiz B' }, stats: {} });
      const cached = await service.getOrSetAggregate('quiz-1', 'vhash1', fetcher2);
      expect(fetcher2).not.toHaveBeenCalled();
      expect(cached).toEqual({ quiz: { title: 'Quiz A' }, stats: {} });
    });

    it('invalidates aggregate cache by quizId', async () => {
      cache.setNow(0);
      await service.getOrSetAggregate('quiz-1', 'vhash1', async () => ({
        quiz: { title: 'Quiz 1' },
      }));

      await service.invalidateAggregate('quiz-1');

      const fetcher = jest.fn().mockResolvedValue({ quiz: { title: 'Quiz 1 fresh' } });
      const fresh = await service.getOrSetAggregate('quiz-1', 'vhash1', fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fresh).toEqual({ quiz: { title: 'Quiz 1 fresh' } });
    });

    it('different versionHash produces different cache entry', async () => {
      cache.setNow(0);

      await service.getOrSetAggregate('quiz-1', 'vhash1', async () => ({ version: 1 }));
      await service.getOrSetAggregate('quiz-1', 'vhash2', async () => ({ version: 2 }));

      const fetcher = jest.fn();
      const cached1 = await service.getOrSetAggregate('quiz-1', 'vhash1', fetcher);
      expect(cached1).toEqual({ version: 1 });

      const cached2 = await service.getOrSetAggregate('quiz-1', 'vhash2', fetcher);
      expect(cached2).toEqual({ version: 2 });
    });
  });
});
