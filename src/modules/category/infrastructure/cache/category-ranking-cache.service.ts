import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { RankedCategoryRow } from '../../domain/ports';

export const CATEGORY_RANKING_CACHE_TTL_MS = 10 * 60 * 1000;
export const CATEGORY_RANKING_CACHE_NAMESPACE = 'category:ranking';

const STAMPEDE_LOCK_TTL_MS = 5_000;
const STAMPEDE_RETRY_DELAY_MS = 50;
const STAMPEDE_MAX_RETRIES = 10;

@Injectable()
export class CategoryRankingCache implements OnModuleDestroy {
  private static readonly CACHE_KEY_PREFIX = CATEGORY_RANKING_CACHE_NAMESPACE;
  private static readonly POPULAR_KEY = `${CATEGORY_RANKING_CACHE_NAMESPACE}:popular:v1`;
  private static readonly TRENDING_KEY = `${CATEGORY_RANKING_CACHE_NAMESPACE}:trending:v1`;

  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(CategoryRankingCache.name)
    private readonly logger: PinoLogger,
  ) {}

  async getOrSetPopular<T extends RankedCategoryRow[]>(fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      CategoryRankingCache.POPULAR_KEY,
      CATEGORY_RANKING_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async getOrSetTrending<T extends RankedCategoryRow[]>(fetcher: () => Promise<T>): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      CategoryRankingCache.TRENDING_KEY,
      CATEGORY_RANKING_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidatePopular(): Promise<void> {
    await this.cache.del(CategoryRankingCache.POPULAR_KEY);
    this.logger.debug({ event: 'category_popular_cache_invalidated' });
  }

  async invalidateTrending(): Promise<void> {
    await this.cache.del(CategoryRankingCache.TRENDING_KEY);
    this.logger.debug({ event: 'category_trending_cache_invalidated' });
  }

  async invalidateAll(): Promise<void> {
    await Promise.all([this.invalidatePopular(), this.invalidateTrending()]);
    this.logger.debug({ event: 'category_ranking_cache_invalidated' });
  }

  onModuleDestroy(): void {
    // No cleanup needed for read-through cache.
  }
}
