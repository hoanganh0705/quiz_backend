/**
 * Rule Engine Service
 *
 * Evaluates badge rules and triggers awards based on user activity.
 * This is the core evaluation engine that drives the Achievement Domain.
 *
 * Uses distributed Redis cache for badge definitions and rules to ensure
 * consistency across multiple instances.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type {
  BadgeDefinitionRow,
  UserBadgeRow,
} from '../../infrastructure/repositories/achievement.repository';
import { AchievementCacheService } from '../../infrastructure/cache/achievement-cache.service';
import type {
  BadgeCacheEntry,
  RuleCacheEntry,
} from '../../infrastructure/cache/achievement-cache.service';

export interface EvaluationContext {
  userId: string;
  eventType: string;
  eventData: Record<string, unknown>;
}

export interface RuleConfig {
  metric: string;
  threshold?: number;
  operator?: '>=' | '<=' | '==' | '>' | '<' | '!=';
  period?: string;
  count?: number;
}

export interface EvaluationResult {
  badgeId: string;
  slug: string;
  name: string;
  awarded: boolean;
  progress?: Record<string, unknown>;
}

@Injectable()
export class RuleEngineService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly cacheService: AchievementCacheService,
    @InjectPinoLogger(RuleEngineService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Evaluate all applicable badges for an event.
   */
  async evaluateEvent(context: EvaluationContext): Promise<EvaluationResult[]> {
    const [badges, rulesByType] = await Promise.all([
      this.cacheService.getBadges(),
      this.getRulesByType(context.eventType),
    ]);

    const results: EvaluationResult[] = [];

    for (const rule of rulesByType) {
      const badge = badges[rule.badgeId];
      if (!badge || !badge.isValid || !badge.isActive) {
        continue;
      }

      const result = await this.evaluateRule(rule, badge, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate badges for a specific category.
   */
  async evaluateByCategory(
    context: EvaluationContext,
    category: string,
  ): Promise<EvaluationResult[]> {
    const [badges, rulesByType] = await Promise.all([
      this.cacheService.getBadges(),
      this.getRulesByType(context.eventType),
    ]);

    const results: EvaluationResult[] = [];

    for (const rule of rulesByType) {
      const badge = badges[rule.badgeId];
      if (!badge || !badge.isValid || !badge.isActive || badge.category !== category) {
        continue;
      }

      const result = await this.evaluateRule(rule, badge, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Get progress for a user's badge.
   */
  async getBadgeProgress(userId: string, badgeId: string): Promise<Record<string, unknown> | null> {
    return this.achievementRepository.getBadgeProgress(userId, badgeId);
  }

  /**
   * Check if a user already has a specific badge.
   */
  hasBadge(userId: string, badgeId: string): Promise<boolean> {
    return this.achievementRepository.hasBadge(userId, badgeId);
  }

  /**
   * Get all badges a user has earned.
   */
  async getUserBadges(
    userId: string,
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    return this.achievementRepository.getUserBadgesWithDetails(userId);
  }

  /**
   * Award a badge to a user.
   */
  async awardBadge(
    userId: string,
    badgeId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      throw new Error(`Badge not found: ${badgeId}`);
    }

    await this.achievementRepository.awardBadge({
      userId,
      badgeId,
      badgeVersion: badge.version,
      metadata,
    });

    this.logger.info({
      event: 'badge_awarded_by_rule_engine',
      userId,
      badgeId,
      badgeSlug: badge.slug,
    });
  }

  /**
   * Invalidate caches. Call after badge/rule mutations.
   */
  async invalidateCaches(): Promise<void> {
    await this.cacheService.invalidateAllCaches();
    this.logger.info({
      event: 'rule_engine_caches_invalidated',
    });
  }

  /**
   * Force cache refresh (for testing or manual invalidation).
   */
  async forceCacheRefresh(): Promise<void> {
    await this.cacheService.forceRefresh();
  }

  private async getRulesByType(eventType: string): Promise<RuleCacheEntry[]> {
    return this.cacheService.getRulesByEventType(eventType);
  }

  private async evaluateRule(
    rule: RuleCacheEntry,
    badge: BadgeCacheEntry,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    try {
      const conditionMet = this.checkCondition(rule.ruleType, rule.config, context);

      if (conditionMet) {
        const alreadyHas = await this.achievementRepository.hasBadge(context.userId, rule.badgeId);
        if (!alreadyHas) {
          await this.awardBadge(context.userId, rule.badgeId, {
            triggeredBy: context.eventType,
            ruleId: rule.ruleId,
          });
        }

        return {
          badgeId: rule.badgeId,
          slug: badge.slug,
          name: badge.name,
          awarded: true,
        };
      }

      return {
        badgeId: rule.badgeId,
        slug: badge.slug,
        name: badge.name,
        awarded: false,
        progress: this.calculateProgress(rule, context),
      };
    } catch (error) {
      this.logger.error({
        event: 'rule_evaluation_error',
        ruleId: rule.ruleId,
        badgeId: rule.badgeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        badgeId: rule.badgeId,
        slug: badge.slug,
        name: badge.name,
        awarded: false,
      };
    }
  }

  private checkCondition(
    ruleType: string,
    config: Record<string, unknown>,
    context: EvaluationContext,
  ): boolean {
    void ruleType;
    const ruleConfig = config as unknown as RuleConfig;
    const currentValue = this.extractMetricValue(ruleConfig.metric, context);

    if (currentValue === null) {
      return false;
    }

    const threshold = ruleConfig.threshold ?? 1;
    const operator = ruleConfig.operator ?? '>=';

    return this.compareValues(currentValue, operator, threshold);
  }

  private extractMetricValue(metric: string, context: EvaluationContext): number | null {
    const eventData = context.eventData;

    switch (metric) {
      case 'quizzes_completed':
        return typeof eventData.quizCount === 'number' ? eventData.quizCount : null;

      case 'period_rank':
        return typeof eventData.rank === 'number' ? eventData.rank : null;

      case 'streak_days':
        return typeof eventData.streakDays === 'number' ? eventData.streakDays : null;

      case 'tournaments_won':
        return typeof eventData.tournamentsWon === 'number' ? eventData.tournamentsWon : null;

      case 'perfect_scores':
        return typeof eventData.perfectScores === 'number' ? eventData.perfectScores : null;

      case 'xp_total':
        return typeof eventData.xpTotal === 'number' ? eventData.xpTotal : null;

      case 'current_rank':
        return typeof eventData.currentRank === 'number' ? eventData.currentRank : null;

      case 'score_percentage':
        return typeof eventData.scorePercentage === 'number' ? eventData.scorePercentage : null;

      default:
        this.logger.error({
          event: 'unknown_metric',
          metric,
        });
        return null;
    }
  }

  private compareValues(current: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>=':
        return current >= threshold;
      case '<=':
        return current <= threshold;
      case '==':
        return current === threshold;
      case '>':
        return current > threshold;
      case '<':
        return current < threshold;
      case '!=':
        return current !== threshold;
      default:
        return false;
    }
  }

  private calculateProgress(
    rule: RuleCacheEntry,
    context: EvaluationContext,
  ): Record<string, unknown> {
    const config = rule.config as unknown as RuleConfig;
    const currentValue = this.extractMetricValue(config.metric, context);
    const threshold = config.threshold ?? 1;

    return {
      current: currentValue ?? 0,
      target: threshold,
      percentage:
        currentValue !== null && threshold > 0
          ? Math.min(100, Math.round((currentValue / threshold) * 100))
          : 0,
    };
  }
}
