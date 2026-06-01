/**
 * Profile Cache Service
 *
 * Redis-based caching for profile statistics to reduce load on source domains.
 * Implements layered caching with event-driven invalidation.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InjectCacheManager, CacheManager } from '@nestjs/cache-manager';
import type { StatisticsView, RankingView, ActivityView } from '../types/profile.types';

export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for stats
export const RANKING_CACHE_TTL_MS = 60 * 1000; // 1 minute for ranks
export const ACTIVITY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for activity

export const CACHE_KEYS = {
  statistics: (userId: string) => `profile:stats:${userId}`,
  ranking: (userId: string) => `profile:ranking:${userId}`,
  activity: (userId: string) => `profile:activity:${userId}`,
  fullProfile: (userId: string) => `profile:full:${userId}`,
} as const;

@Injectable()
export class ProfileCacheService {
  constructor(
    @InjectCacheManager()
    private readonly cacheManager: CacheManager,
    @InjectPinoLogger(ProfileCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get statistics from cache.
   */
  async getStatistics(userId: string): Promise<StatisticsView | null | undefined> {
    const key = CACHE_KEYS.statistics(userId);
    return this.cacheManager.get<StatisticsView>(key);
  }

  /**
   * Set statistics in cache.
   */
  async setStatistics(userId: string, statistics: StatisticsView): Promise<void> {
    const key = CACHE_KEYS.statistics(userId);
    await this.cacheManager.set(key, statistics, PROFILE_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: PROFILE_CACHE_TTL_MS,
    });
  }

  /**
   * Get ranking from cache.
   */
  async getRanking(userId: string): Promise<RankingView | null | undefined> {
    const key = CACHE_KEYS.ranking(userId);
    return this.cacheManager.get<RankingView>(key);
  }

  /**
   * Set ranking in cache.
   */
  async setRanking(userId: string, ranking: RankingView): Promise<void> {
    const key = CACHE_KEYS.ranking(userId);
    await this.cacheManager.set(key, ranking, RANKING_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: RANKING_CACHE_TTL_MS,
    });
  }

  /**
   * Get activity from cache.
   */
  async getActivity(userId: string): Promise<ActivityView | null | undefined> {
    const key = CACHE_KEYS.activity(userId);
    return this.cacheManager.get<ActivityView>(key);
  }

  /**
   * Set activity in cache.
   */
  async setActivity(userId: string, activity: ActivityView): Promise<void> {
    const key = CACHE_KEYS.activity(userId);
    await this.cacheManager.set(key, activity, ACTIVITY_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: ACTIVITY_CACHE_TTL_MS,
    });
  }

  /**
   * Get full profile from cache.
   */
  async getFullProfile(userId: string): Promise<Record<string, unknown> | null | undefined> {
    const key = CACHE_KEYS.fullProfile(userId);
    return this.cacheManager.get(key);
  }

  /**
   * Set full profile in cache.
   */
  async setFullProfile(userId: string, profile: Record<string, unknown>): Promise<void> {
    const key = CACHE_KEYS.fullProfile(userId);
    await this.cacheManager.set(key, profile, PROFILE_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: PROFILE_CACHE_TTL_MS,
    });
  }

  /**
   * Invalidate statistics cache.
   */
  async invalidateStatistics(userId: string): Promise<void> {
    const key = CACHE_KEYS.statistics(userId);
    await this.cacheManager.del(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
  }

  /**
   * Invalidate ranking cache.
   */
  async invalidateRanking(userId: string): Promise<void> {
    const key = CACHE_KEYS.ranking(userId);
    await this.cacheManager.del(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
  }

  /**
   * Invalidate activity cache.
   */
  async invalidateActivity(userId: string): Promise<void> {
    const key = CACHE_KEYS.activity(userId);
    await this.cacheManager.del(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
  }

  /**
   * Invalidate all profile caches for a user.
   */
  async invalidateAll(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateStatistics(userId),
      this.invalidateRanking(userId),
      this.invalidateActivity(userId),
      this.cacheManager.del(CACHE_KEYS.fullProfile(userId)),
    ]);
    this.logger.debug({
      event: 'cache_all_invalidated',
      userId,
    });
  }

  /**
   * Handle cache invalidation based on external events.
   */
  async handleExternalEvent(event: {
    userId: string;
    eventType: string;
  }): Promise<void> {
    switch (event.eventType) {
      case 'attempt.completed':
        await this.invalidateStatistics(event.userId);
        break;
      case 'xp.added':
        await this.invalidateStatistics(event.userId);
        await this.invalidateRanking(event.userId);
        break;
      case 'rank.changed':
        await this.invalidateRanking(event.userId);
        break;
      case 'rank.milestone':
        await this.invalidateRanking(event.userId);
        break;
      case 'achievement.awarded':
      case 'badge.earned':
        await this.invalidateStatistics(event.userId);
        break;
      case 'tournament.joined':
      case 'tournament.completed':
      case 'tournament.won':
        await this.invalidateStatistics(event.userId);
        await this.invalidateActivity(event.userId);
        break;
      default:
        this.logger.debug({
          event: 'cache_invalidation_noop',
          eventType: event.eventType,
        });
    }
  }
}
