import type { CacheProvider } from '@/common/ports/cache.provider';
import type { HomeBundleResponseDto } from '../dto/response/home-bundle-response.dto';
import { HomeCacheService } from './home-cache.service';

const STAMPEDE_LOCK_TTL_MS = 5_000;
const STAMPEDE_RETRY_DELAY_MS = 50;
const STAMPEDE_MAX_RETRIES = 10;

describe('HomeCacheService', () => {
  let cache: CacheProvider;
  let service: HomeCacheService;

  const HOME_CACHE_KEY = 'home:v1';
  const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

  const fakeBundle: HomeBundleResponseDto = {
    featured: [],
    trending: [],
    popular: [],
    categories: [],
    recentWinners: { winners: [], lastUpdated: new Date().toISOString() },
    topPlayers: [],
  };

  const mockLogger = {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    assign: jest.fn(),
  };

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      getOrSet: jest.fn(),
      getOrSetWithStampedeProtection: jest.fn(),
      del: jest.fn(),
      unlinkByPattern: jest.fn(),
    } as unknown as CacheProvider;

    service = new HomeCacheService(cache, mockLogger as never);
  });

  describe('getOrSetBundle', () => {
    it('uses stampede protection with correct key and TTL', async () => {
      (cache.getOrSetWithStampedeProtection as jest.Mock).mockResolvedValue(fakeBundle);

      const fetcher = jest.fn().mockResolvedValue(fakeBundle);
      const result = await service.getOrSetBundle(fetcher);

      expect(cache.getOrSetWithStampedeProtection).toHaveBeenCalledWith<
        [string, number, () => Promise<HomeBundleResponseDto>, number, number, number]
      >(
        HOME_CACHE_KEY,
        HOME_CACHE_TTL_MS,
        fetcher,
        STAMPEDE_LOCK_TTL_MS,
        STAMPEDE_RETRY_DELAY_MS,
        STAMPEDE_MAX_RETRIES,
      );
      expect(result).toBe(fakeBundle);
    });

    it('returns the bundle from cache on hit', async () => {
      (cache.getOrSetWithStampedeProtection as jest.Mock).mockResolvedValue(fakeBundle);

      const fetcher = jest.fn();
      const result = await service.getOrSetBundle(fetcher);

      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toBe(fakeBundle);
    });

    it('calls fetcher on cache miss and caches the result', async () => {
      const fetchedBundle: HomeBundleResponseDto = {
        ...fakeBundle,
        featured: [{ quizId: 'q1' } as never],
      };
      (cache.getOrSetWithStampedeProtection as jest.Mock).mockImplementation(
        async (_, __, fetcher) => fetcher(),
      );

      const fetcher = jest.fn().mockResolvedValue(fetchedBundle);
      const result = await service.getOrSetBundle(fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result).toEqual(fetchedBundle);
    });

    it('propagates fetcher errors', async () => {
      const error = new Error('Database error');
      (cache.getOrSetWithStampedeProtection as jest.Mock).mockImplementation(
        async (_, __, fetcher) => fetcher(),
      );

      const fetcher = jest.fn().mockRejectedValue(error);

      await expect(service.getOrSetBundle(fetcher)).rejects.toThrow('Database error');
    });
  });

  describe('invalidate', () => {
    it('deletes the home cache key', async () => {
      (cache.del as jest.Mock).mockResolvedValue(true);

      await service.invalidate();

      expect(cache.del).toHaveBeenCalledWith(HOME_CACHE_KEY);
    });

    it('handles cache miss gracefully', async () => {
      (cache.del as jest.Mock).mockResolvedValue(false);

      await expect(service.invalidate()).resolves.not.toThrow();
    });
  });
});
