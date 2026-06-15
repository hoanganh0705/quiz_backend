import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeType } from '../types/achievement.types';
import { RankAchievementParams } from '../types/achievement.types';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import { RuleEngineService } from './rule-engine.service';
import { AchievementDomainEventBus } from '../events/achievement-domain.event-bus';
import { BADGE_THRESHOLDS } from '../constants/achievement.constants';

@Injectable()
export class RankAchievementService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly ruleEngineService: RuleEngineService,
    private readonly achievementDomainEventBus: AchievementDomainEventBus,
    @InjectPinoLogger(RankAchievementService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Check and award rank-based achievements.
   */
  async checkRankAchievements(params: RankAchievementParams): Promise<void> {
    const eligible = await this.getEligibleRankBadges({
      userId: params.userId,
      currentRank: params.currentRank,
      previousRank: params.previousRank,
    });

    for (const badgeType of eligible) {
      await this.awardRankBadge(params.userId, badgeType, {
        period: params.period,
        rank: params.currentRank,
      });
    }

    if (eligible.length > 0) {
      this.logger.info({
        event: 'rank_achievements_awarded',
        userId: params.userId,
        badges: eligible,
        currentRank: params.currentRank,
      });
    }
  }

  private async getEligibleRankBadges(params: {
    userId: string;
    currentRank: number;
    previousRank: number | null;
  }): Promise<BadgeType[]> {
    const eligible: BadgeType[] = [];

    if (params.currentRank === BADGE_THRESHOLDS.RANK.RANK_1) {
      if (!(await this.ruleEngineService.hasBadge(params.userId, BadgeType.RANK_1))) {
        eligible.push(BadgeType.RANK_1);
      }
    }

    if (params.currentRank <= BADGE_THRESHOLDS.RANK.TOP_10) {
      if (!(await this.ruleEngineService.hasBadge(params.userId, BadgeType.TOP_10))) {
        eligible.push(BadgeType.TOP_10);
      }
    }

    if (params.currentRank <= BADGE_THRESHOLDS.RANK.TOP_100) {
      if (!(await this.ruleEngineService.hasBadge(params.userId, BadgeType.TOP_100))) {
        eligible.push(BadgeType.TOP_100);
      }
    }

    if (params.currentRank <= BADGE_THRESHOLDS.RANK.TOP_1000) {
      if (!(await this.ruleEngineService.hasBadge(params.userId, BadgeType.TOP_1000))) {
        eligible.push(BadgeType.TOP_1000);
      }
    }

    return eligible;
  }

  private async awardRankBadge(
    userId: string,
    badgeType: BadgeType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const badge = await this.achievementRepository.getBadgeById(badgeType);
    if (!badge) return;

    await this.achievementRepository.awardBadge({
      userId,
      badgeId: badgeType,
      earnedAt: new Date(),
      metadata,
    });

    this.achievementDomainEventBus.emitAchievementAwarded({
      userId,
      badgeId: badge.badgeId,
      badge,
      metadata,
    });

    this.achievementDomainEventBus.emitBadgeEarned({
      userId,
      badgeSlug: badge.slug,
      badgeName: badge.name,
    });

    this.logger.info({
      event: 'badge_awarded',
      userId,
      badgeType,
      metadata,
    });
  }
}
