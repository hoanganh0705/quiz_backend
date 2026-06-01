/**
 * Profile Cache Service
 *
 * Redis-based caching for profile statistics to reduce load on source domains.
 * Implements layered caching with event-driven invalidation.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
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
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(
    @InjectPinoLogger(ProfileCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  private getValue<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  private setValue(key: string, value: unknown, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private deleteValue(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get statistics from cache.
   */
  getStatistics(userId: string): Promise<StatisticsView | undefined> {
    const key = CACHE_KEYS.statistics(userId);
    return Promise.resolve(this.getValue<StatisticsView>(key));
  }

  /**
   * Set statistics in cache.
   */
  setStatistics(userId: string, statistics: StatisticsView): Promise<void> {
    const key = CACHE_KEYS.statistics(userId);
    this.setValue(key, statistics, PROFILE_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: PROFILE_CACHE_TTL_MS,
    });
    return Promise.resolve();
  }

  /**
   * Get ranking from cache.
   */
  getRanking(userId: string): Promise<RankingView | undefined> {
    const key = CACHE_KEYS.ranking(userId);
    return Promise.resolve(this.getValue<RankingView>(key));
  }

  /**
   * Set ranking in cache.
   */
  setRanking(userId: string, ranking: RankingView): Promise<void> {
    const key = CACHE_KEYS.ranking(userId);
    this.setValue(key, ranking, RANKING_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: RANKING_CACHE_TTL_MS,
    });
    return Promise.resolve();
  }

  /**
   * Get activity from cache.
   */
  getActivity(userId: string): Promise<ActivityView | undefined> {
    const key = CACHE_KEYS.activity(userId);
    return Promise.resolve(this.getValue<ActivityView>(key));
  }

  /**
   * Set activity in cache.
   */
  setActivity(userId: string, activity: ActivityView): Promise<void> {
    const key = CACHE_KEYS.activity(userId);
    this.setValue(key, activity, ACTIVITY_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: ACTIVITY_CACHE_TTL_MS,
    });
    return Promise.resolve();
  }

  /**
   * Get full profile from cache.
   */
  getFullProfile(userId: string): Promise<Record<string, unknown> | undefined> {
    const key = CACHE_KEYS.fullProfile(userId);
    return Promise.resolve(this.getValue<Record<string, unknown>>(key));
  }

  /**
   * Set full profile in cache.
   */
  setFullProfile(userId: string, profile: Record<string, unknown>): Promise<void> {
    const key = CACHE_KEYS.fullProfile(userId);
    this.setValue(key, profile, PROFILE_CACHE_TTL_MS);
    this.logger.debug({
      event: 'cache_set',
      key,
      ttl: PROFILE_CACHE_TTL_MS,
    });
    return Promise.resolve();
  }

  /**
   * Invalidate statistics cache.
   */
  invalidateStatistics(userId: string): Promise<void> {
    const key = CACHE_KEYS.statistics(userId);
    this.deleteValue(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
    return Promise.resolve();
  }

  /**
   * Invalidate ranking cache.
   */
  invalidateRanking(userId: string): Promise<void> {
    const key = CACHE_KEYS.ranking(userId);
    this.deleteValue(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
    return Promise.resolve();
  }

  /**
   * Invalidate activity cache.
   */
  invalidateActivity(userId: string): Promise<void> {
    const key = CACHE_KEYS.activity(userId);
    this.deleteValue(key);
    this.logger.debug({
      event: 'cache_invalidated',
      key,
    });
    return Promise.resolve();
  }

  /**
   * Invalidate all profile caches for a user.
   */
  async invalidateAll(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateStatistics(userId),
      this.invalidateRanking(userId),
      this.invalidateActivity(userId),
      Promise.resolve(this.deleteValue(CACHE_KEYS.fullProfile(userId))),
    ]);
    this.logger.debug({
      event: 'cache_all_invalidated',
      userId,
    });
  }

  /**
   * Handle cache invalidation based on external events.
   */
  async handleExternalEvent(event: { userId: string; eventType: string }): Promise<void> {
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
