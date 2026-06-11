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

/**
 * Trend direction for a user's rank over a period.
 */
export type RankTrendDirection = 'up' | 'down' | 'stable' | 'new';

/**
 * Rank trend for a specific period, comparing current rank vs previous snapshot.
 */
export interface RankTrend {
  period: 'weekly' | 'monthly' | 'all_time';
  currentRank: number | null;
  previousRank: number | null;
  /** Rank change: positive = moved up (lower rank number), negative = moved down */
  change: number;
  direction: RankTrendDirection;
  currentXp: number;
  previousXp: number | null;
}

export interface RankingPort {
  /**
   * Get ranking entries for a list of user IDs.
   * @param userIds - Array of user IDs to get rankings for
   * @param period - Ranking period (weekly, monthly, all_time)
   */
  getRankingsForUsers(
    userIds: string[],
    period: 'weekly' | 'monthly' | 'all_time',
  ): Promise<Map<string, RankingEntry>>;

  /**
   * Get the total number of participants in a ranking period.
   */
  getTotalParticipants(period: 'weekly' | 'monthly' | 'all_time'): Promise<number>;

  /**
   * Get the rank of a specific user in a period.
   */
  getUserRank(userId: string, period: 'weekly' | 'monthly' | 'all_time'): Promise<number | null>;

  /**
   * Get rank trends for a list of user IDs across multiple periods.
   * Compares current rank/xp with the latest historical snapshot to detect trends.
   * @param userIds - User IDs to get trends for
   * @param periods - Periods to compute trends across
   */
  getRankTrendsForUsers(
    userIds: string[],
    periods: Array<'weekly' | 'monthly' | 'all_time'>,
  ): Promise<Map<string, RankTrend[]>>;
}

export const RANKING_PORT = Symbol('RANKING_PORT');
