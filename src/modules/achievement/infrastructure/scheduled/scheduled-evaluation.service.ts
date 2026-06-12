/**
 * Scheduled Evaluation Service
 *
 * Handles periodic evaluation of badges that cannot be evaluated in real-time:
 * - Progress-based badges requiring aggregation
 * - Multi-step achievements
 * - Streak validation
 * - Time-bounded achievements
 * - Batch badge awards
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../repositories/achievement.repository';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import type { BadgeDefinitionRow } from '../repositories/achievement.repository';
import { SCHEDULED_EVALUATION } from '../../domain/constants/achievement.constants';

export interface ScheduledEvaluationConfig {
  enabled: boolean;
  cronExpression: string;
  batchSize: number;
  staggerDelayMs: number;
}

export interface EvaluationResult {
  badgeId: string;
  slug: string;
  userId: string;
  awarded: boolean;
  error?: string;
}

export interface BatchEvaluationResult {
  processedUsers: number;
  awardedBadges: number;
  errors: number;
  results: EvaluationResult[];
}

@Injectable()
export class ScheduledEvaluationService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private evaluationConfig: ScheduledEvaluationConfig = {
    enabled: true,
    cronExpression: CronExpression.EVERY_HOUR,
    batchSize: SCHEDULED_EVALUATION.DEFAULT_BATCH_SIZE,
    staggerDelayMs: SCHEDULED_EVALUATION.DEFAULT_STAGGER_DELAY_MS,
  };

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly ruleEngineService: RuleEngineService,
    @InjectPinoLogger(ScheduledEvaluationService.name)
    private readonly logger: PinoLogger,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'scheduled_evaluation_service_initialized',
      config: this.evaluationConfig,
    });
  }

  onModuleDestroy(): void {
    this.logger.info({
      event: 'scheduled_evaluation_service_shutdown',
    });
  }

  /**
   * Run scheduled evaluation for deferred badges.
   * This is called by the cron job.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledEvaluation(): Promise<BatchEvaluationResult> {
    if (!this.evaluationConfig.enabled || this.isRunning) {
      this.logger.debug({
        event: 'scheduled_evaluation_skipped',
        reason: this.isRunning ? 'already_running' : 'disabled',
      });
      return {
        processedUsers: 0,
        awardedBadges: 0,
        errors: 0,
        results: [],
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.info({
        event: 'scheduled_evaluation_started',
      });

      const result = await this.evaluateDeferredBadges();

      const duration = Date.now() - startTime;

      this.logger.info({
        event: 'scheduled_evaluation_completed',
        duration,
        ...result,
      });

      return result;
    } catch (error) {
      this.logger.error({
        event: 'scheduled_evaluation_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        processedUsers: 0,
        awardedBadges: 0,
        errors: 1,
        results: [],
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Evaluate all deferred badges.
   * Deferred badges have evaluationMode = 'deferred' or 'both'.
   */
  async evaluateDeferredBadges(): Promise<BatchEvaluationResult> {
    const deferredBadges = await this.getDeferredBadges();
    const results: EvaluationResult[] = [];
    let awardedBadges = 0;
    let errors = 0;

    this.logger.info({
      event: 'evaluating_deferred_badges',
      badgeCount: deferredBadges.length,
    });

    for (const badge of deferredBadges) {
      try {
        const badgeResults = await this.evaluateBadge(badge);
        awardedBadges += badgeResults.filter((r) => r.awarded).length;
        results.push(...badgeResults);
      } catch (error) {
        errors++;
        this.logger.error({
          event: 'badge_evaluation_failed',
          badgeId: badge.badgeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      if (this.evaluationConfig.staggerDelayMs > 0) {
        await this.delay(this.evaluationConfig.staggerDelayMs);
      }
    }

    return {
      processedUsers: results.length,
      awardedBadges,
      errors,
      results,
    };
  }

  /**
   * Get all badges that need deferred evaluation.
   */
  private async getDeferredBadges(): Promise<BadgeDefinitionRow[]> {
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    return allBadges.filter(
      (badge) => badge.evaluationMode === 'deferred' || badge.evaluationMode === 'both',
    );
  }

  /**
   * Evaluate a single badge for all eligible users.
   */
  private async evaluateBadge(badge: BadgeDefinitionRow): Promise<EvaluationResult[]> {
    const rules = await this.achievementRepository.getBadgeRules(badge.badgeId);
    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      // TODO(achievement): implement eligible user resolution using rule.config thresholds
      // e.g. for streak rules, query users with streakDays >= threshold; for rank rules,
      // query users whose current rank satisfies the threshold. The loop below shows the
      // award logic once eligible users are resolved.
      const eligibleUsers: string[] = [];

      for (const userId of eligibleUsers) {
        const hasBadge = await this.achievementRepository.hasBadge(userId, badge.badgeId);

        if (!hasBadge) {
          try {
            await this.ruleEngineService.awardBadge(userId, badge.badgeId, {
              evaluationType: 'scheduled',
              ruleId: rule.ruleId,
            });

            results.push({
              badgeId: badge.badgeId,
              slug: badge.slug,
              userId,
              awarded: true,
            });

            this.logger.info({
              event: 'scheduled_badge_awarded',
              userId,
              badgeId: badge.badgeId,
              slug: badge.slug,
            });
          } catch (error) {
            results.push({
              badgeId: badge.badgeId,
              slug: badge.slug,
              userId,
              awarded: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate streak achievements for users.
   */
  async validateStreakAchievements(): Promise<BatchEvaluationResult> {
    this.logger.info({
      event: 'validating_streak_achievements',
    });

    const streakRules = await this.achievementRepository.getRulesByType('streak');
    const results: EvaluationResult[] = [];
    const awardedBadges = 0;

    for (const rule of streakRules) {
      const config = rule.config;
      const threshold = typeof config.threshold === 'number' ? config.threshold : 7;

      this.logger.debug({
        event: 'streak_validation',
        ruleId: rule.ruleId,
        threshold,
      });
    }

    return {
      processedUsers: results.length,
      awardedBadges,
      errors: 0,
      results,
    };
  }

  /**
   * Validate time-bounded achievements.
   */
  async validateTimeBoundedAchievements(): Promise<BatchEvaluationResult> {
    this.logger.info({
      event: 'validating_time_bounded_achievements',
    });

    const seasonalBadges = await this.achievementRepository.getBadgesByCategory('seasonal');
    const results: EvaluationResult[] = [];

    for (const badge of seasonalBadges) {
      if (!this.achievementRepository.isBadgeValid(badge)) {
        this.logger.info({
          event: 'seasonal_badge_expired',
          badgeId: badge.badgeId,
          slug: badge.slug,
        });

        results.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          userId: '',
          awarded: false,
        });
      }
    }

    return {
      processedUsers: 0,
      awardedBadges: 0,
      errors: 0,
      results,
    };
  }

  /**
   * Re-evaluate badges for a specific user.
   */
  async reevaluateUserBadges(userId: string): Promise<EvaluationResult[]> {
    this.logger.info({
      event: 'reevaluating_user_badges',
      userId,
    });

    const allBadges = await this.achievementRepository.getAllActiveBadges();
    const results: EvaluationResult[] = [];

    const badgeIds = allBadges.map((b) => b.badgeId);
    const ownershipMap = await this.achievementRepository.hasBadges(userId, badgeIds);

    for (const badge of allBadges) {
      if (ownershipMap[badge.badgeId]) continue;

      try {
        await this.ruleEngineService.evaluateEvent({
          userId,
          eventType: 'reevaluation',
          eventData: {},
        });

        results.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          userId,
          awarded: false,
        });
      } catch (error) {
        results.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          userId,
          awarded: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  updateConfig(config: Partial<ScheduledEvaluationConfig>): void {
    this.evaluationConfig = { ...this.evaluationConfig, ...config };
    this.logger.info({
      event: 'evaluation_config_updated',
      config: this.evaluationConfig,
    });
  }

  getConfig(): ScheduledEvaluationConfig {
    return { ...this.evaluationConfig };
  }

  isEvaluationRunning(): boolean {
    return this.isRunning;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
