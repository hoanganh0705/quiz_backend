/**
 * Tournament Query Port
 *
 * Interface for querying tournament data from the Tournament domain.
 * Profile domain never owns tournament data; it only queries and displays it.
 */

import { StatisticsView, TournamentSummary } from '../types';

export const TOURNAMENT_QUERY_PORT = Symbol('TOURNAMENT_QUERY_PORT');

export interface TournamentQueryPort {
  /**
   * Get tournament statistics for a user.
   */
  getUserTournamentStats(
    userId: string,
  ): Promise<Pick<StatisticsView, 'totalTournamentsJoined' | 'totalTournamentsWon'>>;

  /**
   * Get recent tournament participations for a user.
   */
  getRecentTournaments(userId: string, limit?: number): Promise<TournamentSummary[]>;
}
