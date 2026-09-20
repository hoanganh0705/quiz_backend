import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../repositories/achievement.repository';
import type {
  AchievementRepositoryPort,
  BadgeRuleRow,
  BadgeDefinitionRow,
} from '../repositories/achievement.repository';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
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
  metadata?: Record<string, unknown>;
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

  private async getDeferredBadges(): Promise<BadgeDefinitionRow[]> {
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    return allBadges.filter(
      (badge) => badge.evaluationMode === 'deferred' || badge.evaluationMode === 'both',
    );
  }

  private async evaluateBadge(badge: BadgeDefinitionRow): Promise<EvaluationResult[]> {
    const rules = await this.achievementRepository.getBadgeRules(badge.badgeId);
    const results: EvaluationResult[] = [];
    const batchSize = this.evaluationConfig.batchSize;
    let offset = 0;

    for (const rule of rules) {
      let hasMore = true;

      while (hasMore) {
        const eligibleUsers = await this.resolveEligibleUsers(
          rule,
          badge.badgeId,
          batchSize,
          offset,
        );

        this.logger.debug({
          event: 'eligible_users_resolved',
          ruleId: rule.ruleId,
          badgeId: badge.badgeId,
          eligibleCount: eligibleUsers.length,
          offset,
        });

        if (eligibleUsers.length === 0) {
          hasMore = false;
          break;
        }

        if (eligibleUsers.length < batchSize) {
          hasMore = false;
        }

        for (const userInfo of eligibleUsers) {
          const userId = String(userInfo.userId);
          const hasBadge = await this.achievementRepository.hasBadge(userId, badge.badgeId);

          if (!hasBadge) {
            try {
              await this.ruleEngineService.awardBadge(userId, badge.badgeId, {
                evaluationType: 'scheduled',
                ruleId: rule.ruleId,
                ...userInfo,
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
                ruleId: rule.ruleId,
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

        offset += batchSize;

        if (this.evaluationConfig.staggerDelayMs > 0) {
          await this.delay(this.evaluationConfig.staggerDelayMs);
        }
      }
    }

    return results;
  }

  private async resolveEligibleUsers(
    rule: BadgeRuleRow,
    badgeId: string,
    limit: number,
    offset: number,
  ): Promise<Array<Record<string, unknown>>> {
    const config = rule.config;
    const ruleType: string = rule.ruleType;

    switch (ruleType) {
      case 'streak': {
        const threshold = typeof config.threshold === 'number' ? config.threshold : 7;
        const users = await this.achievementRepository.getUsersEligibleForStreakBadge(
          threshold,
          badgeId,
          limit,
          offset,
        );
        return users.map((u) => ({ userId: u.userId, streakDays: u.currentStreak }));
      }

      case 'rank':
      case 'rank_period': {
        const maxRank = typeof config.threshold === 'number' ? config.threshold : 100;
        const period = typeof config.period === 'string' ? config.period : 'all';
        const users = await this.achievementRepository.getUsersEligibleForRankBadge(
          maxRank,
          period,
          badgeId,
          limit,
          offset,
        );
        return users.map((u) => ({ userId: u.userId, rank: u.currentRank, period }));
      }

      case 'count': {
        const users = await this.achievementRepository.getUsersEligibleForStreakBadge(
          1,
          badgeId,
          limit,
          offset,
        );
        return users.map((u) => ({ userId: u.userId }));
      }

      case 'xp_total': {
        const minXp = typeof config.threshold === 'number' ? config.threshold : 1000;
        const users = await this.achievementRepository.getUsersEligibleForStreakBadge(
          1,
          badgeId,
          limit,
          offset,
        );
        return users.map((u) => ({ userId: u.userId, xpTotal: minXp }));
      }

      default:
        this.logger.warn({
          event: 'unsupported_rule_type_for_deferred_evaluation',
          ruleType,
          badgeId,
        });
        return [];
    }
  }

  async validateStreakAchievements(): Promise<BatchEvaluationResult> {
    this.logger.info({
      event: 'validating_streak_achievements',
    });

    const streakRules = await this.achievementRepository.getRulesByType('streak');
    const results: EvaluationResult[] = [];

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
      awardedBadges: 0,
      errors: 0,
      results,
    };
  }

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
