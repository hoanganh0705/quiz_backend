/**
 * Achievement Query Port
 *
 * Interface for querying achievement data from the Achievement domain.
 * Profile domain never owns badge data; it only queries and displays it.
 */

import type { BadgeView } from '../../types/profile.types';

export const ACHIEVEMENT_QUERY_PORT = Symbol('ACHIEVEMENT_QUERY_PORT');

export interface AchievementQueryPort {
  /**
   * Get all badges for a user.
   */
  getUserBadges(userId: string): Promise<BadgeView[]>;

  /**
   * Get recent badges for a user (last N).
   */
  getRecentBadges(userId: string, limit?: number): Promise<BadgeView[]>;

  /**
   * Get total badge count for a user.
   */
  getBadgeCount(userId: string): Promise<number>;

  /**
   * Get longest streak for a user.
   */
  getLongestStreak(userId: string): Promise<number>;
}
