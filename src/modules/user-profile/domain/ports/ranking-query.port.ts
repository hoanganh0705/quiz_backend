/**
 * Ranking Query Port
 *
 * Interface for querying ranking data from the Ranking domain.
 * Profile domain never owns ranking data; it only queries it.
 */

import type { RankInfo, RankingView } from '../../types/profile.types';

export const RANKING_QUERY_PORT = Symbol('RANKING_QUERY_PORT');

export interface RankingQueryPort {
  /**
   * Get the complete ranking view for a user.
   */
  getUserRankingView(userId: string): Promise<RankingView>;

  /**
   * Get rank info for a specific period.
   */
  getRankInfo(userId: string, period: 'all_time' | 'weekly' | 'monthly'): Promise<RankInfo | null>;

  /**
   * Get total XP for a user.
   */
  getTotalXp(userId: string): Promise<number>;
}
