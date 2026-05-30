/**
 * Achievement Port
 *
 * Interface for achievement/gamification services.
 * Ranking domain emits events; achievement domain decides badge assignment.
 */

export const ACHIEVEMENT_PORT = Symbol('ACHIEVEMENT_PORT');

export interface AchievementPort {
  /**
   * Check and award rank-based achievements.
   */
  checkRankAchievements(params: {
    userId: string;
    period: string;
    currentRank: number;
    previousRank: number | null;
    xp: number;
  }): Promise<void>;

  /**
   * Award a consistency badge based on activity.
   */
  awardConsistencyBadge(params: { userId: string; streakDays: number }): Promise<void>;

  /**
   * Award a milestone badge.
   */
  awardMilestoneBadge(params: {
    userId: string;
    badgeType: 'rising_star' | 'veteran' | 'newcomer';
  }): Promise<void>;
}
