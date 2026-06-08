/**
 * Ranking Repository Port
 *
 * Defines the interface for ranking data access.
 */

import { RankingPeriod, RankingMilestone } from '../types/ranking.types';

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
  peakAllTimeRankAchievedAt: string | null;
  peakWeeklyRank: number | null;
  peakWeeklyRankAchievedAt: string | null;
  peakMonthlyRank: number | null;
  peakMonthlyRankAchievedAt: string | null;
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
  snapshotDate: string;
  rank: number;
  xp: number;
  recordedAt: string;
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

export type PeakRanksRow = {
  daily: { rank: number | null; achievedAt: string | null };
  weekly: { rank: number | null; achievedAt: string | null };
  monthly: { rank: number | null; achievedAt: string | null };
  allTime: { rank: number | null; achievedAt: string | null };
};

export type RankSnapshotPairRow = {
  current: RankHistoryRow | null;
  previous: RankHistoryRow | null;
};

export type TopMoverRow = {
  userId: string;
  username: string;
  currentRank: number;
  previousRank: number;
  change: number;
};

export type NearbyRankEntryRow = {
  rank: number;
  userId: string;
  username: string;
  xp: number;
};

export type RankingMilestoneRow = {
  id: string;
  userId: string;
  milestone: RankingMilestone;
  rank: number;
  achievedAt: string;
};

export type LeaderboardDistributionBucketRow = {
  label: string;
  count: number;
};

export type LeaderboardDistributionRow = {
  totalUsers: number;
  remainingUsers: number;
  buckets: LeaderboardDistributionBucketRow[];
};

export type UserPercentileRow = {
  rank: number | null;
  totalUsers: number;
};

export interface RankingRepositoryPort {
  // User Ranking Operations
  getUserRanking(userId: string): Promise<UserRankingRow | null>;

  getUserRankingWithUser(userId: string): Promise<UserRankingWithUserRow | null>;

  createUserRanking(userId: string): Promise<UserRankingRow>;

  updateXp(params: { userId: string; amount: number; now: Date }): Promise<UserRankingRow>;

  markDirty(userIds: string[]): Promise<void>;

  getDirtyUsers(limit: number): Promise<UserRankingRow[]>;

  clearDirtyFlags(userIds: string[]): Promise<void>;

  // Rank Operations
  updateRank(params: { userId: string; period: RankingPeriod; rank: number }): Promise<number | null>;

  updatePeakRank(params: { userId: string; period: RankingPeriod; rank: number }): Promise<boolean>;

  getPeakRanks(userId: string): Promise<PeakRanksRow>;

  // Leaderboard Operations
  getLeaderboard(params: {
    period: RankingPeriod;
    limit: number;
    offset: number;
  }): Promise<LeaderboardRow[]>;

  getTotalParticipants(period: RankingPeriod): Promise<number>;

  getUserRank(userId: string, period: RankingPeriod): Promise<number | null>;

  getLeaderboardSize(period: RankingPeriod): Promise<number>;

  getNextRankXp(period: RankingPeriod, currentRank: number): Promise<number | null>;

  // Rank History Operations
  createRankHistory(params: {
    userId: string;
    period: RankingPeriod;
    snapshotDate: Date;
    rank: number;
    xp: number;
    recordedAt?: Date;
  }): Promise<RankHistoryRow>;

  getUserRankingHistory(params: {
    userId: string;
    period: RankingPeriod;
    from?: Date;
    to?: Date;
  }): Promise<RankHistoryRow[]>;

  getLatestRankSnapshots(params: {
    userId: string;
    period: RankingPeriod;
  }): Promise<RankSnapshotPairRow>;

  getTopMovers(params: {
    period: RankingPeriod;
    limit: number;
  }): Promise<TopMoverRow[]>;

  getNearbyRanks(params: {
    userId: string;
    period: RankingPeriod;
    radius: number;
  }): Promise<{
    above: NearbyRankEntryRow[];
    me: NearbyRankEntryRow | null;
    below: NearbyRankEntryRow[];
  }>;

  createMilestone(params: {
    userId: string;
    milestone: RankingMilestone;
    rank: number;
    achievedAt: Date;
  }): Promise<RankingMilestoneRow>;

  getUserMilestones(userId: string): Promise<RankingMilestoneRow[]>;

  hasMilestone(params: {
    userId: string;
    milestone: RankingMilestone;
  }): Promise<boolean>;

  getLeaderboardDistribution(period: RankingPeriod): Promise<LeaderboardDistributionRow>;

  // Period Reset Operations
  resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number>;

  getUsersWithRanking(): Promise<string[]>;

  // Consistency Check Operations
  findXpMismatches(): Promise<{ userId: string; storedXp: number; expectedXp: number }[]>;

  findMissingRanks(): Promise<string[]>;

  // Inactivity Support (Phase 4)
  getInactiveUsers(daysInactive: number, limit?: number): Promise<UserRankingRow[]>;

  getUserWithCreationDate(
    userId: string,
  ): Promise<{ ranking: UserRankingRow | null; createdAt: string } | null>;

  getActiveUsers(daysActive: number, limit?: number): Promise<UserRankingRow[]>;

  getTopWeeklyGainers(limit?: number): Promise<{ userId: string; weeklyXp: number }[]>;

  isUserInTopWeeklyPercent(userId: string, percent: number): Promise<boolean>;
}

export const RANKING_REPOSITORY_PORT: unique symbol = Symbol('RANKING_REPOSITORY_PORT');
