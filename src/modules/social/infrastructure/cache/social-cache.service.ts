/**
 * Social Cache Service
 *
 * Provides Redis-backed caching for social counts with:
 * - TTL-based cache expiration
 * - Cache invalidation on social graph mutations
 * - Stampede protection for high-traffic endpoints
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { SocialCounts } from '../../domain/types/social.types';

export interface CachedSocialCounts {
  friendCount: number;
  followerCount: number;
  followingCount: number;
  cachedAt: number;
}

@Injectable()
export class SocialCacheService {
  private static readonly CACHE_KEY_PREFIX = 'social:counts';
  private static readonly CACHE_TTL_MS = 30_000; // 30 seconds
  private static readonly LOCK_TTL_MS = 5_000; // 5 seconds

  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(SocialCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get cache key for a user's social counts.
   */
  private getCacheKey(userId: string): string {
    return `${SocialCacheService.CACHE_KEY_PREFIX}:${userId}`;
  }

  /**
   * Get cached social counts for a user.
   */
  async getCachedCounts(userId: string): Promise<CachedSocialCounts | null> {
    const key = this.getCacheKey(userId);
    const cached = await this.cache.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as CachedSocialCounts;
    } catch {
      this.logger.warn({ event: 'social_counts_cache_parse_error', userId });
      return null;
    }
  }

  /**
   * Set cached social counts for a user.
   */
  async setCachedCounts(userId: string, counts: SocialCounts): Promise<void> {
    const key = this.getCacheKey(userId);
    const entry: CachedSocialCounts = {
      ...counts,
      cachedAt: Date.now(),
    };

    await this.cache.set(key, JSON.stringify(entry), SocialCacheService.CACHE_TTL_MS);
    this.logger.debug({ event: 'social_counts_cache_set', userId, counts });
  }

  /**
   * Get social counts with cache.
   * Uses stampede protection to prevent cache stampedes.
   */
  async getCountsWithCache(
    userId: string,
    fetcher: () => Promise<SocialCounts>,
  ): Promise<SocialCounts> {
    const key = this.getCacheKey(userId);

    const cached = await this.cache.getOrSetWithStampedeProtection<CachedSocialCounts>(
      key,
      SocialCacheService.CACHE_TTL_MS,
      async () => {
        const counts = await fetcher();
        return {
          ...counts,
          cachedAt: Date.now(),
        };
      },
      SocialCacheService.LOCK_TTL_MS,
      100,
      50,
    );

    return {
      friendCount: cached.friendCount,
      followerCount: cached.followerCount,
      followingCount: cached.followingCount,
    };
  }

  /**
   * Invalidate cached counts for a user.
   * Called after any social graph mutation.
   */
  async invalidateCounts(userId: string): Promise<void> {
    const key = this.getCacheKey(userId);
    await this.cache.del(key);
    this.logger.debug({ event: 'social_counts_cache_invalidated', userId });
  }

  /**
   * Invalidate cached counts for multiple users.
   * Used after friendship changes where both parties' counts change.
   */
  async invalidateCountsBatch(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.invalidateCounts(userId)));
    this.logger.debug({ event: 'social_counts_cache_invalidated_batch', userIds });
  }
}
