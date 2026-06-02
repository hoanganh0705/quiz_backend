/**
 * Rule Engine Service
 *
 * Evaluates badge rules and triggers awards based on user activity.
 * This is the core evaluation engine that drives the Achievement Domain.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type {
  BadgeDefinitionRow,
  BadgeRuleRow,
} from '../../infrastructure/repositories/achievement.repository';

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
  private badgeDefinitionsCache: Map<string, BadgeDefinitionRow> = new Map();
  private rulesCache: Map<string, BadgeRuleRow[]> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(RuleEngineService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Evaluate all applicable badges for an event.
   */
  async evaluateEvent(context: EvaluationContext): Promise<EvaluationResult[]> {
    await this.refreshCacheIfNeeded();

    const results: EvaluationResult[] = [];
    const applicableRules = this.findApplicableRules(context.eventType);

    for (const rule of applicableRules) {
      const badge = this.badgeDefinitionsCache.get(rule.badgeId);
      if (!badge || !this.achievementRepository.isBadgeValid(badge)) {
        continue;
      }

      const result = await this.evaluateRule(rule, context);
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
    await this.refreshCacheIfNeeded();

    const results: EvaluationResult[] = [];
    const applicableRules = this.findApplicableRules(context.eventType);

    for (const rule of applicableRules) {
      const badge = this.badgeDefinitionsCache.get(rule.badgeId);
      if (!badge || badge.category !== category) {
        continue;
      }

      const result = await this.evaluateRule(rule, context);
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
   * Get all badges a user has earned.
   */
  async getUserBadges(userId: string) {
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
   * Refresh the cache if needed.
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return;
    }

    const badges = await this.achievementRepository.getAllActiveBadges();
    this.badgeDefinitionsCache.clear();
    for (const badge of badges) {
      this.badgeDefinitionsCache.set(badge.badgeId, badge);
    }

    const rules = await this.achievementRepository.getAllActiveRules();
    this.rulesCache.clear();
    for (const rule of rules) {
      const existing = this.rulesCache.get(rule.ruleType) ?? [];
      existing.push(rule);
      this.rulesCache.set(rule.ruleType, existing);
    }

    this.cacheTimestamp = now;

    this.logger.debug({
      event: 'rule_engine_cache_refreshed',
      badgesCount: badges.length,
      rulesCount: rules.length,
    });
  }

  /**
   * Find rules applicable for an event type.
   */
  private findApplicableRules(eventType: string): BadgeRuleRow[] {
    const rules: BadgeRuleRow[] = [];

    // Map event types to rule types
    const eventToRuleType: Record<string, string[]> = {
      'attempt.completed': ['count', 'perfect_score'],
      'ranking.rank_changed': ['rank', 'rank_period'],
      'ranking.milestone': ['rank', 'rank_period'],
      'tournament.won': ['tournament_win'],
      'user.streak_updated': ['streak'],
      'xp.added': ['xp_total'],
      'user.created': ['count'],
    };

    const relevantRuleTypes = eventToRuleType[eventType] ?? [];

    for (const ruleType of relevantRuleTypes) {
      const typeRules = this.rulesCache.get(ruleType) ?? [];
      rules.push(...typeRules);
    }

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a single rule against the context.
   */
  private async evaluateRule(
    rule: BadgeRuleRow,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const badge = this.badgeDefinitionsCache.get(rule.badgeId)!;
    const config = rule.config as unknown as RuleConfig;

    try {
      const conditionMet = this.checkCondition(rule.ruleType, config, context);

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

  /**
   * Check if a rule's condition is met.
   */
  private checkCondition(
    ruleType: string,
    config: RuleConfig,
    context: EvaluationContext,
  ): boolean {
    void ruleType;
    const currentValue = this.extractMetricValue(config.metric, context);

    if (currentValue === null) {
      return false;
    }

    const threshold = config.threshold ?? 1;
    const operator = config.operator ?? '>=';

    return this.compareValues(currentValue, operator, threshold);
  }

  /**
   * Extract metric value from event data.
   */
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
        this.logger.warn({
          event: 'unknown_metric',
          metric,
        });
        return null;
    }
  }

  /**
   * Compare values using the specified operator.
   */
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

  /**
   * Calculate progress for a rule.
   */
  private calculateProgress(
    rule: BadgeRuleRow,
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

  /**
   * Force cache refresh (for testing or manual invalidation).
   */
  async forceCacheRefresh(): Promise<void> {
    this.cacheTimestamp = 0;
    await this.refreshCacheIfNeeded();
  }
}
