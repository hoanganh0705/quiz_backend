import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeType } from '../types/achievement.types';
import { RankAchievementParams } from '../types/achievement.types';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import { BadgeEvaluationService } from './badge-evaluation.service';
import { AchievementDomainEventBus } from '../events/achievement-domain.event-bus';

@Injectable()
export class RankAchievementService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly badgeEvaluationService: BadgeEvaluationService,
    private readonly achievementDomainEventBus: AchievementDomainEventBus,
    @InjectPinoLogger(RankAchievementService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Check and award rank-based achievements.
   */
  async checkRankAchievements(params: RankAchievementParams): Promise<void> {
    const eligible = await this.badgeEvaluationService.getEligibleRankBadges({
      userId: params.userId,
      currentRank: params.currentRank,
      previousRank: params.previousRank,
    });

    for (const badgeType of eligible) {
      await this.awardBadge(params.userId, badgeType, {
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

  private async awardBadge(
    userId: string,
    badgeType: BadgeType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const userBadge = await this.achievementRepository.awardBadge({
      userId,
      badgeId: badgeType,
      earnedAt: new Date(),
      metadata,
    });
    const badge = await this.achievementRepository.getBadgeById(userBadge.badgeId);

    if (badge) {
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
    }

    this.logger.info({
      event: 'badge_awarded',
      userId,
      badgeType,
      metadata,
    });
  }
}
