/**
 * Achievement Cache Service
 *
 * Provides Redis-backed caching for badge definitions and rules with:
 * - TTL-based cache expiration
 * - Distributed lock for cache refresh (stampede protection)
 * - Cache invalidation on badge/rule mutations
 * - Multi-instance consistency
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';

export interface BadgeCacheEntry {
  badgeId: string;
  slug: string;
  name: string;
  type: string;
  category: string;
  isActive: boolean;
  isValid: boolean;
}

export interface RuleCacheEntry {
  ruleId: string;
  badgeId: string;
  ruleType: string;
  priority: number;
  config: Record<string, unknown>;
}

export interface CachedBadgeData {
  badges: Record<string, BadgeCacheEntry>;
  rules: Record<string, RuleCacheEntry[]>;
  cachedAt: number;
  version: string;
}

@Injectable()
export class AchievementCacheService {
  private static readonly CACHE_KEY_PREFIX = 'achievement:cache';
  private static readonly BADGE_CACHE_KEY = `${AchievementCacheService.CACHE_KEY_PREFIX}:badges`;
  private static readonly RULES_CACHE_KEY = `${AchievementCacheService.CACHE_KEY_PREFIX}:rules`;
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute
  private static readonly LOCK_TTL_MS = 5_000; // 5 seconds
  private static readonly STAMPEDE_MAX_RETRIES = 20;
  private static readonly STAMPEDE_RETRY_DELAY_MS = 100;

  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly repository: AchievementRepositoryPort,
    @InjectPinoLogger(AchievementCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get all active badge definitions from cache or database.
   * Uses stampede protection to prevent cache stampedes.
   */
  async getBadges(): Promise<Record<string, BadgeCacheEntry>> {
    const cached = await this.getCachedBadges();

    if (cached) {
      this.logger.debug({
        event: 'badge_cache_hit',
        badgeCount: Object.keys(cached).length,
      });
      return cached;
    }

    return this.refreshBadgeCacheWithLock();
  }

  /**
   * Get all active rules from cache or database.
   * Uses stampede protection to prevent cache stampedes.
   */
  async getRules(): Promise<Record<string, RuleCacheEntry[]>> {
    const cached = await this.getCachedRules();

    if (cached) {
      this.logger.debug({
        event: 'rules_cache_hit',
        ruleTypeCount: Object.keys(cached).length,
      });
      return cached;
    }

    return this.refreshRulesCacheWithLock();
  }

  /**
   * Get rules by event type (grouped by ruleType).
   */
  async getRulesByEventType(eventType: string): Promise<RuleCacheEntry[]> {
    const rulesByType = await this.getRules();
    const ruleTypes = this.getRuleTypesForEvent(eventType);

    const rules: RuleCacheEntry[] = [];
    for (const ruleType of ruleTypes) {
      const typeRules = rulesByType[ruleType] ?? [];
      rules.push(...typeRules);
    }

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Invalidate badge cache. Call this when badges are created, updated, or deleted.
   */
  async invalidateBadgeCache(): Promise<void> {
    await this.cache.del(AchievementCacheService.BADGE_CACHE_KEY);
    this.logger.info({
      event: 'badge_cache_invalidated',
    });
  }

  /**
   * Invalidate rules cache. Call this when rules are created, updated, or deleted.
   */
  async invalidateRulesCache(): Promise<void> {
    await this.cache.del(AchievementCacheService.RULES_CACHE_KEY);
    this.logger.info({
      event: 'rules_cache_invalidated',
    });
  }

  /**
   * Invalidate all achievement caches.
   */
  async invalidateAllCaches(): Promise<void> {
    await Promise.all([this.invalidateBadgeCache(), this.invalidateRulesCache()]);
    this.logger.info({
      event: 'achievement_cache_invalidated',
    });
  }

  /**
   * Refresh badges cache with distributed lock to prevent stampedes.
   */
  async refreshBadgeCacheWithLock(): Promise<Record<string, BadgeCacheEntry>> {
    const cached = await this.getCachedBadges();
    if (cached) {
      return cached;
    }

    const lockKey = `${AchievementCacheService.BADGE_CACHE_KEY}:lock`;
    const lockAcquired = await this.cache.acquireAdvisoryLock(
      lockKey,
      AchievementCacheService.LOCK_TTL_MS,
    );

    if (lockAcquired) {
      try {
        return await this.refreshBadgeCache();
      } finally {
        await this.cache.releaseAdvisoryLock(lockKey, '1');
      }
    }

    return this.waitForCacheRefresh(AchievementCacheService.BADGE_CACHE_KEY);
  }

  /**
   * Refresh rules cache with distributed lock to prevent stampedes.
   */
  async refreshRulesCacheWithLock(): Promise<Record<string, RuleCacheEntry[]>> {
    const cached = await this.getCachedRules();
    if (cached) {
      return cached;
    }

    const lockKey = `${AchievementCacheService.RULES_CACHE_KEY}:lock`;
    const lockAcquired = await this.cache.acquireAdvisoryLock(
      lockKey,
      AchievementCacheService.LOCK_TTL_MS,
    );

    if (lockAcquired) {
      try {
        return await this.refreshRulesCache();
      } finally {
        await this.cache.releaseAdvisoryLock(lockKey, '1');
      }
    }

    return this.waitForCacheRefresh(AchievementCacheService.RULES_CACHE_KEY);
  }

  /**
   * Force refresh all caches. Use after bulk operations.
   */
  async forceRefresh(): Promise<void> {
    await this.invalidateAllCaches();
    await Promise.all([this.refreshBadgeCache(), this.refreshRulesCache()]);
    this.logger.info({
      event: 'achievement_cache_force_refreshed',
    });
  }

  private async getCachedBadges(): Promise<Record<string, BadgeCacheEntry> | null> {
    const cached = await this.cache.get(AchievementCacheService.BADGE_CACHE_KEY);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached) as Record<string, BadgeCacheEntry>;
      return parsed;
    } catch {
      this.logger.warn({
        event: 'badge_cache_parse_failed',
      });
      return null;
    }
  }

  private async getCachedRules(): Promise<Record<string, RuleCacheEntry[]> | null> {
    const cached = await this.cache.get(AchievementCacheService.RULES_CACHE_KEY);
    if (!cached) return null;

    try {
      const parsed = JSON.parse(cached) as Record<string, RuleCacheEntry[]>;
      return parsed;
    } catch {
      this.logger.warn({
        event: 'rules_cache_parse_failed',
      });
      return null;
    }
  }

  private async refreshBadgeCache(): Promise<Record<string, BadgeCacheEntry>> {
    const badges = await this.repository.getAllActiveBadges();
    const now = new Date();

    const cacheEntries: Record<string, BadgeCacheEntry> = {};
    for (const badge of badges) {
      const validFrom = badge.validFrom;
      const validUntil = badge.validUntil;
      const isValid = this.isBadgeValid(validFrom, validUntil, now);

      cacheEntries[badge.badgeId] = {
        badgeId: badge.badgeId,
        slug: badge.slug,
        name: badge.name,
        type: badge.type,
        category: badge.category,
        isActive: badge.isActive,
        isValid,
      };
    }

    await this.cache.set(
      AchievementCacheService.BADGE_CACHE_KEY,
      JSON.stringify(cacheEntries),
      AchievementCacheService.CACHE_TTL_MS,
    );

    this.logger.debug({
      event: 'badge_cache_refreshed',
      badgeCount: Object.keys(cacheEntries).length,
    });

    return cacheEntries;
  }

  private async refreshRulesCache(): Promise<Record<string, RuleCacheEntry[]>> {
    const rules = await this.repository.getAllActiveRules();

    const cacheEntries: Record<string, RuleCacheEntry[]> = {};
    for (const rule of rules) {
      const entry: RuleCacheEntry = {
        ruleId: rule.ruleId,
        badgeId: rule.badgeId,
        ruleType: rule.ruleType,
        priority: rule.priority,
        config: rule.config,
      };

      const existing = cacheEntries[rule.ruleType] ?? [];
      existing.push(entry);
      cacheEntries[rule.ruleType] = existing;
    }

    await this.cache.set(
      AchievementCacheService.RULES_CACHE_KEY,
      JSON.stringify(cacheEntries),
      AchievementCacheService.CACHE_TTL_MS,
    );

    this.logger.debug({
      event: 'rules_cache_refreshed',
      ruleTypeCount: Object.keys(cacheEntries).length,
    });

    return cacheEntries;
  }

  private async waitForCacheRefresh<T>(cacheKey: string): Promise<T> {
    for (let i = 0; i < AchievementCacheService.STAMPEDE_MAX_RETRIES; i++) {
      await this.sleep(AchievementCacheService.STAMPEDE_RETRY_DELAY_MS);

      const cached = await this.cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          // Continue waiting
        }
      }
    }

    // Fallback: compute directly (should rarely happen)
    this.logger.warn({
      event: 'cache_refresh_timeout_fallback',
      cacheKey,
    });

    if (cacheKey === AchievementCacheService.BADGE_CACHE_KEY) {
      return this.refreshBadgeCache() as Promise<T>;
    } else {
      return this.refreshRulesCache() as Promise<T>;
    }
  }

  private isBadgeValid(validFrom: Date | null, validUntil: Date | null, now: Date): boolean {
    if (validFrom && now < validFrom) return false;
    if (validUntil && now > validUntil) return false;
    return true;
  }

  private getRuleTypesForEvent(eventType: string): string[] {
    const eventToRuleType: Record<string, string[]> = {
      'attempt.completed': ['count', 'perfect_score'],
      perfect_score: ['perfect_score'],
      'ranking.rank_changed': ['rank', 'rank_period'],
      'ranking.milestone': ['rank', 'rank_period'],
      'tournament.won': ['tournament_win'],
      'user.streak_updated': ['streak'],
      'xp.added': ['xp_total'],
      'user.created': ['count'],
      'quiz.milestone': ['count'],
      'quiz.completed': ['count'],
    };

    return eventToRuleType[eventType] ?? [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
