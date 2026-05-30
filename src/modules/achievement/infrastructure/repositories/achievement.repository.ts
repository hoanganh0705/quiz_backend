/**
 * Achievement Repository Port
 *
 * Defines the interface for achievement data access.
 */

import { BadgeType } from '../../domain/types/achievement.types';

export type UserBadgeRow = {
  userId: string;
  badgeType: BadgeType;
  awardedAt: Date;
  metadata?: Record<string, unknown>;
};

export interface AchievementRepositoryPort {
  /**
   * Check if user already has a specific badge.
   */
  hasBadge(userId: string, badgeType: BadgeType): Promise<boolean>;

  /**
   * Award a badge to a user.
   */
  awardBadge(params: {
    userId: string;
    badgeType: BadgeType;
    awardedAt: Date;
    metadata?: Record<string, unknown>;
  }): Promise<UserBadgeRow>;

  /**
   * Get all badges for a user.
   */
  getUserBadges(userId: string): Promise<UserBadgeRow[]>;

  /**
   * Get user activity streak in days.
   */
  getUserStreak(userId: string): Promise<number>;

  /**
   * Record activity for streak tracking.
   */
  recordActivity(userId: string, activityDate: Date): Promise<void>;
}

export const ACHIEVEMENT_REPOSITORY_PORT: unique symbol = Symbol('ACHIEVEMENT_REPOSITORY_PORT');
