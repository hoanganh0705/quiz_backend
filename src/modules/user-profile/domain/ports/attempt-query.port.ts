/**
 * Attempt Query Port
 *
 * Interface for querying attempt data from the Attempt domain.
 * Profile domain never owns attempt data; it only queries and displays it.
 */

import type { AttemptSummary, StatisticsView } from '../../types/profile.types';

export const ATTEMPT_QUERY_PORT = Symbol('ATTEMPT_QUERY_PORT');

export interface AttemptQueryPort {
  /**
   * Get attempt statistics for a user.
   */
  getUserStatistics(userId: string): Promise<Omit<StatisticsView, 'totalXp' | 'totalTournamentsJoined' | 'totalTournamentsWon' | 'longestStreak'>>;

  /**
   * Get recent attempts for a user.
   */
  getRecentAttempts(userId: string, limit?: number): Promise<AttemptSummary[]>;

  /**
   * Get total completed quizzes count.
   */
  getTotalCompletedQuizzes(userId: string): Promise<number>;
}
