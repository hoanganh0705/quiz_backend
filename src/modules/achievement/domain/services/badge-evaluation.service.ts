/**
 * Badge Evaluation Service
 *
 * Evaluates badge eligibility based on user activity and ranking data.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeType } from '../types/achievement.types';
import { UserBadge } from '../types/achievement.types';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';

@Injectable()
export class BadgeEvaluationService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(BadgeEvaluationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Check if user already has a badge.
   */
  async hasBadge(userId: string, badgeType: BadgeType): Promise<boolean> {
    return this.achievementRepository.hasBadge(userId, badgeType);
  }

  /**
   * Check which rank-based badges user is eligible for.
   */
  async getEligibleRankBadges(params: {
    userId: string;
    currentRank: number;
    previousRank: number | null;
  }): Promise<BadgeType[]> {
    const eligible: BadgeType[] = [];

    if (params.currentRank === 1) {
      const has = await this.hasBadge(params.userId, BadgeType.RANK_1);
      if (!has) eligible.push(BadgeType.RANK_1);
    }

    if (params.currentRank <= 10) {
      const has = await this.hasBadge(params.userId, BadgeType.TOP_10);
      if (!has) eligible.push(BadgeType.TOP_10);
    }

    if (params.currentRank <= 100) {
      const has = await this.hasBadge(params.userId, BadgeType.TOP_100);
      if (!has) eligible.push(BadgeType.TOP_100);
    }

    if (params.currentRank <= 1000) {
      const has = await this.hasBadge(params.userId, BadgeType.TOP_1000);
      if (!has) eligible.push(BadgeType.TOP_1000);
    }

    return eligible;
  }

  /**
   * Check which consistency badges user is eligible for.
   */
  async getEligibleConsistencyBadges(params: {
    userId: string;
    streakDays: number;
  }): Promise<BadgeType[]> {
    const eligible: BadgeType[] = [];

    if (params.streakDays >= 7) {
      const has = await this.hasBadge(params.userId, BadgeType.STREAK_7);
      if (!has) eligible.push(BadgeType.STREAK_7);
    }

    if (params.streakDays >= 30) {
      const has = await this.hasBadge(params.userId, BadgeType.STREAK_30);
      if (!has) eligible.push(BadgeType.STREAK_30);
    }

    if (params.streakDays >= 100) {
      const has = await this.hasBadge(params.userId, BadgeType.STREAK_100);
      if (!has) eligible.push(BadgeType.STREAK_100);
    }

    return eligible;
  }

  /**
   * Get all badges for a user.
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return this.achievementRepository.getUserBadges(userId);
  }
}
