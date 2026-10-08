import type { CacheProvider } from '@/common/ports/cache.provider';
import { CategoryRankingCache } from './category-ranking-cache.service';
import type { RankedCategoryRow } from '../../domain/ports';

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

  async del(key: string): Promise<boolean> {
    const existed = this.store.delete(key);
    this.ttlByKey.delete(key);
    return existed;
  }
}

describe('CategoryRankingCache', () => {
  let cache: InMemoryCache;
  let service: CategoryRankingCache;

  const popularData = [
    {
      categoryId: 'c1',
      name: 'Popular Cat',
      slug: 'popular-cat',
      description: null,
      imageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      rank: 1,
      totalScore: '0',
      totalAttempts: '0',
    },
  ] satisfies RankedCategoryRow[];
  const trendingData = [
    {
      categoryId: 'c2',
      name: 'Trending Cat',
      slug: 'trending-cat',
      description: null,
      imageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      rank: 1,
      totalScore: '0',
      totalAttempts: '0',
    },
  ] satisfies RankedCategoryRow[];

  beforeEach(() => {
    cache = new InMemoryCache();
    service = new CategoryRankingCache(
      cache as unknown as CacheProvider,
      {
        warn: () => undefined,
        info: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      } as never,
    );
  });

  describe('getOrSetPopular', () => {
    it('caches and returns popular categories', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(popularData);
      const result = await service.getOrSetPopular(fetcher);

      expect(result).toStrictEqual(popularData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on subsequent calls', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(popularData);
      await service.getOrSetPopular(fetcher);

      const secondFetcher = jest.fn();
      const cached = await service.getOrSetPopular(secondFetcher);

      expect(secondFetcher).not.toHaveBeenCalled();
      expect(cached).toStrictEqual(popularData);
    });

    it('expires after TTL', async () => {
      cache.setNow(0);

      await service.getOrSetPopular(async () => popularData);
      cache.setNow(11 * 60 * 1000);

      const fetcher = jest.fn().mockResolvedValue([
        {
          categoryId: 'c3',
          name: 'New Cat',
          slug: 'new-cat',
          description: null,
          imageUrl: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          rank: 1,
          totalScore: '0',
          totalAttempts: '0',
        },
      ] satisfies RankedCategoryRow[]);
      const result = await service.getOrSetPopular(fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).not.toBe(popularData);
    });
  });

  describe('getOrSetTrending', () => {
    it('caches and returns trending categories', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(trendingData);
      const result = await service.getOrSetTrending(fetcher);

      expect(result).toStrictEqual(trendingData);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on subsequent calls', async () => {
      cache.setNow(0);

      const fetcher = jest.fn().mockResolvedValue(trendingData);
      await service.getOrSetTrending(fetcher);

      const secondFetcher = jest.fn();
      const cached = await service.getOrSetTrending(secondFetcher);

      expect(secondFetcher).not.toHaveBeenCalled();
      expect(cached).toStrictEqual(trendingData);
    });
  });

  describe('invalidatePopular', () => {
    it('clears popular cache', async () => {
      cache.setNow(0);
      await service.getOrSetPopular(async () => popularData);

      await service.invalidatePopular();

      const fetcher = jest.fn().mockResolvedValue([
        {
          categoryId: 'c9',
          name: 'Fresh',
          slug: 'fresh',
          description: null,
          imageUrl: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          rank: 1,
          totalScore: '0',
          totalAttempts: '0',
        },
      ] satisfies RankedCategoryRow[]);
      const result = await service.getOrSetPopular(fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).not.toBe(popularData);
    });
  });

  describe('invalidateTrending', () => {
    it('clears trending cache', async () => {
      cache.setNow(0);
      await service.getOrSetTrending(async () => trendingData);

      await service.invalidateTrending();

      const fetcher = jest.fn().mockResolvedValue([
        {
          categoryId: 'c9',
          name: 'Fresh',
          slug: 'fresh',
          description: null,
          imageUrl: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          rank: 1,
          totalScore: '0',
          totalAttempts: '0',
        },
      ] satisfies RankedCategoryRow[]);
      const result = await service.getOrSetTrending(fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).not.toBe(trendingData);
    });
  });

  describe('invalidateAll', () => {
    it('clears both popular and trending caches', async () => {
      cache.setNow(0);
      await service.getOrSetPopular(async () => popularData);
      await service.getOrSetTrending(async () => trendingData);

      await service.invalidateAll();

      const popularFetcher = jest
        .fn()
        .mockResolvedValue([{ categoryId: 'c9', name: 'New Popular' }]);
      const trendingFetcher = jest
        .fn()
        .mockResolvedValue([{ categoryId: 'c9', name: 'New Trending' }]);

      await service.getOrSetPopular(popularFetcher);
      await service.getOrSetTrending(trendingFetcher);

      expect(popularFetcher).toHaveBeenCalledTimes(1);
      expect(trendingFetcher).toHaveBeenCalledTimes(1);
    });
  });
});
