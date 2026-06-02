/**
 * Ranking Query Port
 *
 * Interface for querying user rankings.
 * Allows Social domain to get friend rankings without duplicating ranking logic.
 */

export interface RankingEntry {
  userId: string;
  xp: number;
}

export interface RankingPort {
  /**
   * Get ranking entries for a list of user IDs.
   * @param userIds - Array of user IDs to get rankings for
   * @param period - Ranking period (weekly, monthly, all_time)
   */
  getRankingsForUsers(userIds: string[], period: 'weekly' | 'monthly' | 'all_time'): Promise<Map<string, RankingEntry>>;

  /**
   * Get the total number of participants in a ranking period.
   */
  getTotalParticipants(period: 'weekly' | 'monthly' | 'all_time'): Promise<number>;

  /**
   * Get the rank of a specific user in a period.
   */
  getUserRank(userId: string, period: 'weekly' | 'monthly' | 'all_time'): Promise<number | null>;
}

export const RANKING_PORT = Symbol('RANKING_PORT');
