/**
 * Ranking Repository Port
 *
 * Defines the interface for ranking data access.
 */

import { RankingPeriod } from '../types/ranking.types';

export type UserRankingRow = {
  userId: string;
  allTimeXp: number;
  weeklyXp: number;
  monthlyXp: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  monthlyRank: number | null;
  lastWeeklyResetAt: string | null;
  lastMonthlyResetAt: string | null;
  peakAllTimeRank: number | null;
  peakWeeklyRank: number | null;
  peakMonthlyRank: number | null;
  peakRankAchievedAt: string | null;
  lastActivityAt: string | null;
  isDirty: boolean;
  updatedAt: string;
};

export type UserRankingWithUserRow = UserRankingRow & {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type RankHistoryRow = {
  historyId: string;
  userId: string;
  period: RankingPeriod;
  periodStart: string | null;
  periodEnd: string | null;
  xpAtStart: number;
  xpAtEnd: number;
  rankAtEnd: number | null;
  peakRank: number | null;
  peakXp: number | null;
  createdAt: string;
};

export type LeaderboardRow = {
  userId: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  xp: number;
  rank: number;
  denseRank: number;
};

export interface RankingRepositoryPort {
  // User Ranking Operations
  getUserRanking(userId: string): Promise<UserRankingRow | null>;

  getUserRankingWithUser(userId: string): Promise<UserRankingWithUserRow | null>;

  createUserRanking(userId: string): Promise<UserRankingRow>;

  updateXp(params: {
    userId: string;
    amount: number;
    now: Date;
  }): Promise<UserRankingRow>;

  markDirty(userIds: string[]): Promise<void>;

  getDirtyUsers(limit: number): Promise<UserRankingRow[]>;

  clearDirtyFlags(userIds: string[]): Promise<void>;

  // Rank Operations
  updateRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<void>;

  updatePeakRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<boolean>;

  // Leaderboard Operations
  getLeaderboard(params: {
    period: RankingPeriod;
    limit: number;
    offset: number;
  }): Promise<LeaderboardRow[]>;

  getTotalParticipants(period: RankingPeriod): Promise<number>;

  getUserRank(userId: string, period: RankingPeriod): Promise<number | null>;

  getNextRankXp(period: RankingPeriod, currentRank: number): Promise<number | null>;

  // Rank History Operations
  createRankHistory(params: {
    userId: string;
    period: RankingPeriod;
    periodStart: Date | null;
    periodEnd: Date;
    xpAtStart: number;
    xpAtEnd: number;
    rankAtEnd: number | null;
    peakRank: number | null;
    peakXp: number | null;
  }): Promise<RankHistoryRow>;

  getRankHistory(userId: string, period: RankingPeriod, limit?: number): Promise<RankHistoryRow[]>;

  // Period Reset Operations
  resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number>;

  getUsersWithRanking(): Promise<string[]>;

  // Consistency Check Operations
  findXpMismatches(): Promise<{ userId: string; storedXp: number; expectedXp: number }[]>;

  findMissingRanks(): Promise<string[]>;
}
