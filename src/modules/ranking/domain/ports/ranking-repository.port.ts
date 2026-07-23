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
  dailyXp: number;
  allTimeRank: number | null;
  weeklyRank: number | null;
  monthlyRank: number | null;
  dailyRank: number | null;
  lastWeeklyResetAt: string | null;
  lastMonthlyResetAt: string | null;
  lastDailyResetAt: string | null;
  peakAllTimeRank: number | null;
  peakAllTimeRankAchievedAt: string | null;
  peakWeeklyRank: number | null;
  peakWeeklyRankAchievedAt: string | null;
  peakMonthlyRank: number | null;
  peakMonthlyRankAchievedAt: string | null;
  peakDailyRank: number | null;
  peakDailyRankAchievedAt: string | null;
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

  getRankingsForUsers(userIds: string[]): Promise<UserRankingRow[]>;

  createUserRanking(userId: string): Promise<UserRankingRow>;

  updateXp(params: { userId: string; amount: number; now: Date }): Promise<UserRankingRow>;

  /**
   * Like `updateXp` but accepts an explicit transaction client for use in
   * callers that manage their own transactions (e.g. XpIngestionService).
   */
  updateXpInTx(
    tx: unknown,
    params: { userId: string; amount: number; now: Date },
  ): Promise<UserRankingRow>;

  markDirty(userIds: string[]): Promise<void>;

  /**
   * Like `markDirty` but accepts an explicit transaction client.
   */
  markDirtyInTx(tx: unknown, userIds: string[]): Promise<void>;

  /**
   * Enqueue rank recalculation work items for the given users and
   * periods. Inserts one row per (user, period) pair into
   * `rank_recalculation_work_items` with `ON CONFLICT (user_id,
   * period) DO NOTHING`, so concurrent enqueues for the same pair are
   * idempotent. Also flips the per-user `is_dirty` latch on
   * `user_ranking` for fast existence checks.
   */
  enqueueRecalculation(params: { userIds: string[]; periods: RankingPeriod[] }): Promise<void>;

  /**
   * Like {@link enqueueRecalculation} but participates in the caller's
   * transaction. Used by XP ingestion so the work-item insert and the
   * XP update commit atomically.
   */
  enqueueRecalculationInTx(
    tx: unknown,
    params: { userIds: string[]; periods: RankingPeriod[] },
  ): Promise<void>;

  /**
   * Fetch up to `limit` pending work items, joined with the
   * `user_ranking` row. Items are returned oldest-first so the queue
   * is FIFO. The returned rows include `workItemId` so the caller can
   * delete the work item once the recalculation completes.
   */
  getPendingRecalculationWorkItems(
    limit: number,
  ): Promise<Array<{ workItemId: string; userId: string; period: string }>>;

  /**
   * Delete work items by ID. Called by the recalculation processor
   * after a successful recompute.
   */
  completeRecalculationWorkItems(workItemIds: string[]): Promise<void>;

  /**
   * Like {@link completeRecalculationWorkItems} but accepts an explicit
   * transaction client for atomic batch completion.
   */
  completeRecalculationWorkItemsInTx(tx: unknown, workItemIds: string[]): Promise<void>;

  getDirtyUsers(limit: number): Promise<UserRankingRow[]>;

  clearDirtyFlags(userIds: string[]): Promise<void>;

  /**
   * Clear the per-user `is_dirty` latch for the subset of `userIds`
   * that have zero remaining rows in `rank_recalculation_work_items`.
   * Implemented as a single grouped query that returns the IDs to
   * clear, then a single `UPDATE … WHERE user_id IN (…)`. Used by the
   * batch processor to drop the latch exactly when the work queue is
   * drained for each user.
   */
  clearDirtyFlagsForUsersWithNoPendingWork(userIds: string[]): Promise<void>;

  /**
   * Like {@link clearDirtyFlagsForUsersWithNoPendingWork} but accepts
   * an explicit transaction client for atomic latch clearing.
   */
  clearDirtyFlagsForUsersWithNoPendingWorkInTx(tx: unknown, userIds: string[]): Promise<void>;

  // Rank Operations
  updateRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<number | null>;

  updatePeakRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<{ updated: boolean; previousPeakRank: number | null }>;

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

  getTopMovers(params: { period: RankingPeriod; limit: number }): Promise<TopMoverRow[]>;

  getNearbyRanks(params: { userId: string; period: RankingPeriod; radius: number }): Promise<{
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

  hasMilestone(params: { userId: string; milestone: RankingMilestone }): Promise<boolean>;

  getLeaderboardDistribution(period: RankingPeriod): Promise<LeaderboardDistributionRow>;

  // Batch rank calculation using window functions
  calculateAllRanksForUsers(params: {
    userIds: string[];
    period: RankingPeriod;
  }): Promise<{ userId: string; xp: number; rank: number; denseRank: number }[]>;

  // Full rank recalculation using window functions
  calculateAllRanks(period: RankingPeriod): Promise<
    {
      userId: string;
      xp: number;
      rank: number;
      denseRank: number;
    }[]
  >;

  // Count how many users have strictly more XP (used for single-user rank lookup)
  countRankAbove(xp: number, period: RankingPeriod): Promise<number>;

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
