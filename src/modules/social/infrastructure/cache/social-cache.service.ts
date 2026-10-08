/**
 * Social Cache Service
 *
 * Provides Redis-backed caching for social counts with:
 * - TTL-based cache expiration
 * - Cache invalidation on social graph mutations
 * - Stampede protection for high-traffic endpoints
 * - Domain-event subscription as a defense-in-depth invalidation
 *   path so out-of-band writers (admin tools, data fixers) cannot
 *   leave the counts cache stale.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';
import {
  SOCIAL_DOMAIN_EVENT_BUS,
  type SocialDomainEventBusPort,
  type SocialDomainEvent,
} from '../../domain/events/social-event-bus.port';
import type { SocialCounts } from '../../domain/types/social.types';

export interface CachedSocialCounts {
  friendCount: number;
  followerCount: number;
  followingCount: number;
  cachedAt: number;
}

@Injectable()
export class SocialCacheService implements OnModuleInit, OnModuleDestroy {
  private static readonly CACHE_KEY_PREFIX = 'social:counts';
  private static readonly CACHE_TTL_MS = 120_000; // 120 seconds
  private static readonly LOCK_TTL_MS = 5_000; // 5 seconds

  private static readonly AFFECTED_USER_ID_KEYS = [
    'requesterId',
    'addresseeId',
    'userId',
    'friendId',
    'blockerId',
    'blockedId',
    'followerId',
    'followingId',
  ] as const;

  private unsubscribe?: () => void;

  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(SocialCacheService.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly eventBus?: SocialDomainEventBusPort,
  ) {}

  onModuleInit(): void {
    if (!this.eventBus) return;

    this.unsubscribe = this.eventBus.subscribe((event) => {
      const userIds = this.userIdsFromEvent(event);
      if (userIds.length === 0) return;

      this.invalidateCountsBatch(userIds).catch((error) => {
        this.logger.warn({
          event: 'social_counts_cache_invalidation_failed',
          source: 'domain_event',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
  }

  onModuleDestroy(): void {
    try {
      this.unsubscribe?.();
    } catch {
      // Ignore unsubscribe errors during shutdown.
    }
    this.unsubscribe = undefined;
  }

  private userIdsFromEvent(event: SocialDomainEvent): string[] {
    const seen = new Set<string>();
    for (const key of SocialCacheService.AFFECTED_USER_ID_KEYS) {
      const candidate = (event as unknown as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && candidate.length > 0) {
        seen.add(candidate);
      }
    }
    return Array.from(seen);
  }

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
