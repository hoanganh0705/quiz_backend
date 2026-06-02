/**
 * Consistency Service
 *
 * Tracks user activity streaks and awards consistency badges.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeType, ConsistencyBadgeParams } from '../types/achievement.types';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import { BadgeEvaluationService } from './badge-evaluation.service';

@Injectable()
export class ConsistencyService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly badgeEvaluationService: BadgeEvaluationService,
    @InjectPinoLogger(ConsistencyService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Award consistency badges based on activity streak.
   */
  async awardConsistencyBadge(params: ConsistencyBadgeParams): Promise<void> {
    const eligible = await this.badgeEvaluationService.getEligibleConsistencyBadges({
      userId: params.userId,
      streakDays: params.streakDays,
    });

    for (const badgeType of eligible) {
      await this.awardBadge(params.userId, badgeType, { streakDays: params.streakDays });
    }

    if (eligible.length > 0) {
      this.logger.info({
        event: 'consistency_badges_awarded',
        userId: params.userId,
        streakDays: params.streakDays,
        badges: eligible,
      });
    }
  }

  private async awardBadge(
    userId: string,
    badgeType: BadgeType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.achievementRepository.awardBadge({
      userId,
      badgeId: badgeType,
      earnedAt: new Date(),
      metadata,
    });
  }
}
