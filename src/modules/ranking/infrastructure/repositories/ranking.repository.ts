/**
 * Ranking Repository Implementation
 *
 * A thin façade that delegates every public method to one of the injectable
 * collaborators. Public surface (RankingRepositoryPort interface and the
 * RANKING_REPOSITORY_PORT injection token) does not change.
 */

import { Injectable } from '@nestjs/common';
import { UserRankingRepository } from './aggregates/user-ranking.repository';
import { LeaderboardRepository } from './aggregates/leaderboard.repository';
import { RankHistoryRepository } from './aggregates/rank-history.repository';
import { RankingMilestoneRepository } from './aggregates/ranking-milestone.repository';
import { PeriodResetRepository } from './aggregates/period-reset.repository';
import type {
  RankingRepositoryPort,
  UserRankingRow,
  UserRankingWithUserRow,
  RankHistoryRow,
  LeaderboardRow,
  PeakRanksRow,
  TopMoverRow,
  NearbyRankEntryRow,
  RankingMilestoneRow,
  LeaderboardDistributionRow,
  RankSnapshotPairRow,
} from '../../domain/ports/ranking-repository.port';
import { RankingPeriod, RankingMilestone } from '../../domain/types/ranking.types';

@Injectable()
export class RankingRepository implements RankingRepositoryPort {
  constructor(
    private readonly userRanking: UserRankingRepository,
    private readonly leaderboard: LeaderboardRepository,
    private readonly rankHistory: RankHistoryRepository,
    private readonly milestone: RankingMilestoneRepository,
    private readonly periodReset: PeriodResetRepository,
  ) {}

  // ============================================
  // User Ranking Operations
  // ============================================

  async getUserRanking(userId: string): Promise<UserRankingRow | null> {
    return this.userRanking.getUserRanking(userId);
  }

  async getUserRankingWithUser(userId: string): Promise<UserRankingWithUserRow | null> {
    return this.userRanking.getUserRankingWithUser(userId);
  }

  async getRankingsForUsers(userIds: string[]): Promise<UserRankingRow[]> {
    return this.userRanking.getRankingsForUsers(userIds);
  }

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    return this.userRanking.createUserRanking(userId);
  }

  async updateXp(params: { userId: string; amount: number; now: Date }): Promise<UserRankingRow> {
    return this.userRanking.updateXp(params);
  }

  /**
   * Like `updateXp` but accepts an explicit transaction client for use in
   * callers that manage their own transactions (e.g. XpIngestionService).
   */
  async updateXpInTx(
    tx: unknown,
    params: { userId: string; amount: number; now: Date },
  ): Promise<UserRankingRow> {
    return this.userRanking.updateXpInTx(tx, params);
  }

  async markDirty(userIds: string[]): Promise<void> {
    return this.userRanking.markDirty(userIds);
  }

  /**
   * Like `markDirty` but accepts an explicit transaction client.
   */
  async markDirtyInTx(tx: unknown, userIds: string[]): Promise<void> {
    return this.userRanking.markDirtyInTx(tx, userIds);
  }

  /**
   * Enqueue rank recalculation work items for the given users and
   * periods. Inserts one row per (user, period) pair into
   * `rank_recalculation_work_items` with `ON CONFLICT (user_id,
   * period) DO NOTHING`, so concurrent enqueues for the same pair are
   * idempotent. Also flips the per-user `is_dirty` latch on
   * `user_ranking` for fast existence checks.
   */
  async enqueueRecalculation(params: {
    userIds: string[];
    periods: RankingPeriod[];
  }): Promise<void> {
    return this.userRanking.enqueueRecalculation(params);
  }

  /**
   * Like {@link enqueueRecalculation} but participates in the caller's
   * transaction. Used by XP ingestion so the work-item insert and the
   * XP update commit atomically.
   */
  async enqueueRecalculationInTx(
    tx: unknown,
    params: { userIds: string[]; periods: RankingPeriod[] },
  ): Promise<void> {
    return this.userRanking.enqueueRecalculationInTx(tx, params);
  }

  /**
   * Fetch up to `limit` pending work items, joined with the
   * `user_ranking` row. Items are returned oldest-first so the queue
   * is FIFO. The returned rows include `workItemId` so the caller can
   * delete the work item once the recalculation completes.
   */
  async getPendingRecalculationWorkItems(
    limit: number,
  ): Promise<Array<{ workItemId: string; userId: string; period: string }>> {
    return this.userRanking.getPendingRecalculationWorkItems(limit);
  }

  /**
   * Delete work items by ID. Called by the recalculation processor
   * after a successful recompute.
   */
  async completeRecalculationWorkItems(workItemIds: string[]): Promise<void> {
    return this.userRanking.completeRecalculationWorkItems(workItemIds);
  }

  /**
   * Like {@link completeRecalculationWorkItems} but accepts an explicit
   * transaction client for atomic batch completion.
   */
  async completeRecalculationWorkItemsInTx(tx: unknown, workItemIds: string[]): Promise<void> {
    return this.userRanking.completeRecalculationWorkItemsInTx(tx, workItemIds);
  }

  async getDirtyUsers(limit: number): Promise<UserRankingRow[]> {
    return this.userRanking.getDirtyUsers(limit);
  }

  async countDirtyUsers(): Promise<number> {
    return this.userRanking.countDirtyUsers();
  }

  async clearDirtyFlags(userIds: string[]): Promise<void> {
    return this.userRanking.clearDirtyFlags(userIds);
  }

  /**
   * Clear the per-user `is_dirty` latch for the subset of `userIds`
   * that have zero remaining rows in `rank_recalculation_work_items`.
   * Implemented as a single grouped query that returns the IDs to
   * clear, then a single `UPDATE … WHERE user_id IN (…)`. Used by the
   * batch processor to drop the latch exactly when the work queue is
   * drained for each user.
   */
  async clearDirtyFlagsForUsersWithNoPendingWork(userIds: string[]): Promise<void> {
    return this.userRanking.clearDirtyFlagsForUsersWithNoPendingWork(userIds);
  }

  /**
   * Like {@link clearDirtyFlagsForUsersWithNoPendingWork} but accepts
   * an explicit transaction client for atomic latch clearing.
   */
  async clearDirtyFlagsForUsersWithNoPendingWorkInTx(
    tx: unknown,
    userIds: string[],
  ): Promise<void> {
    return this.userRanking.clearDirtyFlagsForUsersWithNoPendingWorkInTx(tx, userIds);
  }

  // ============================================
  // Rank Operations
  // ============================================

  async updateRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<number | null> {
    return this.userRanking.updateRank(params);
  }

  async updatePeakRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<{ updated: boolean; previousPeakRank: number | null }> {
    return this.userRanking.updatePeakRank(params);
  }

  async getPeakRanks(userId: string): Promise<PeakRanksRow> {
    return this.userRanking.getPeakRanks(userId);
  }

  // ============================================
  // Leaderboard Operations
  // ============================================

  async getLeaderboard(params: {
    period: RankingPeriod;
    limit: number;
    offset: number;
  }): Promise<LeaderboardRow[]> {
    return this.leaderboard.getLeaderboard(params);
  }

  async getLeaderboardKeyset(params: {
    period: RankingPeriod;
    limit: number;
    cursorXp?: number | null;
    cursorCreatedAt?: string | null;
    cursorUserId?: string | null;
  }): Promise<LeaderboardRow[]> {
    return this.leaderboard.getLeaderboardKeyset(params);
  }

  async getLeaderboardCursorFirstPage(params: {
    period: RankingPeriod;
    limit: number;
  }): Promise<LeaderboardRow[]> {
    return this.leaderboard.getLeaderboardCursorFirstPage(params);
  }

  async getTotalParticipants(period: RankingPeriod): Promise<number> {
    return this.leaderboard.getTotalParticipants(period);
  }

  async getLeaderboardSize(period: RankingPeriod): Promise<number> {
    return this.leaderboard.getLeaderboardSize(period);
  }

  async getUserRank(userId: string, period: RankingPeriod): Promise<number | null> {
    return this.leaderboard.getUserRank(userId, period);
  }

  async getNextRankXp(period: RankingPeriod, currentRank: number): Promise<number | null> {
    return this.leaderboard.getNextRankXp(period, currentRank);
  }

  async getNearbyRanks(params: { userId: string; period: RankingPeriod; radius: number }): Promise<{
    above: NearbyRankEntryRow[];
    me: NearbyRankEntryRow | null;
    below: NearbyRankEntryRow[];
  }> {
    return this.leaderboard.getNearbyRanks(params);
  }

  async getLeaderboardDistribution(period: RankingPeriod): Promise<LeaderboardDistributionRow> {
    return this.leaderboard.getLeaderboardDistribution(period);
  }

  async calculateAllRanksForUsers(params: {
    userIds: string[];
    period: RankingPeriod;
  }): Promise<{ userId: string; xp: number; rank: number; denseRank: number }[]> {
    return this.leaderboard.calculateAllRanksForUsers(params);
  }

  async calculateAllRanks(period: RankingPeriod): Promise<
    {
      userId: string;
      xp: number;
      rank: number;
      denseRank: number;
    }[]
  > {
    return this.leaderboard.calculateAllRanks(period);
  }

  async countRankAbove(xp: number, period: RankingPeriod): Promise<number> {
    return this.leaderboard.countRankAbove(xp, period);
  }

  // ============================================
  // Rank History Operations
  // ============================================

  async createRankHistory(params: {
    userId: string;
    period: RankingPeriod;
    snapshotDate: Date;
    rank: number;
    xp: number;
    recordedAt?: Date;
  }): Promise<RankHistoryRow> {
    return this.rankHistory.createRankHistory(params);
  }

  async getUserRankingHistory(params: {
    userId: string;
    period: RankingPeriod;
    from?: Date;
    to?: Date;
  }): Promise<RankHistoryRow[]> {
    return this.rankHistory.getUserRankingHistory(params);
  }

  async getLatestRankSnapshots(params: {
    userId: string;
    period: RankingPeriod;
  }): Promise<RankSnapshotPairRow> {
    return this.rankHistory.getLatestRankSnapshots(params);
  }

  async getTopMovers(params: { period: RankingPeriod; limit: number }): Promise<TopMoverRow[]> {
    return this.rankHistory.getTopMovers(params);
  }

  // ============================================
  // Milestone Operations
  // ============================================

  async createMilestone(params: {
    userId: string;
    milestone: RankingMilestone;
    rank: number;
    achievedAt: Date;
  }): Promise<RankingMilestoneRow> {
    return this.milestone.createMilestone(params);
  }

  async getUserMilestones(userId: string): Promise<RankingMilestoneRow[]> {
    return this.milestone.getUserMilestones(userId);
  }

  async hasMilestone(params: { userId: string; milestone: RankingMilestone }): Promise<boolean> {
    return this.milestone.hasMilestone(params);
  }

  // ============================================
  // Period Reset Operations
  // ============================================

  async resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number> {
    return this.periodReset.resetPeriod(period, resetAt);
  }

  async getUsersWithRanking(): Promise<string[]> {
    return this.userRanking.getUsersWithRanking();
  }

  // ============================================
  // Consistency Check Operations
  // ============================================

  async findXpMismatches(): Promise<{ userId: string; storedXp: number; expectedXp: number }[]> {
    return this.userRanking.findXpMismatches();
  }

  async findMissingRanks(): Promise<string[]> {
    return this.userRanking.findMissingRanks();
  }

  async getInactiveUsers(daysInactive: number, limit = 100): Promise<UserRankingRow[]> {
    return this.userRanking.getInactiveUsers(daysInactive, limit);
  }

  /**
   * Get user with their creation date for badge calculation.
   */
  async getUserWithCreationDate(userId: string): Promise<{
    ranking: UserRankingRow | null;
    createdAt: string;
  } | null> {
    return this.userRanking.getUserWithCreationDate(userId);
  }

  /**
   * Get users active in the last N days.
   */
  async getActiveUsers(daysActive: number, limit = 100): Promise<UserRankingRow[]> {
    return this.userRanking.getActiveUsers(daysActive, limit);
  }

  /**
   * Get top weekly XP gainers (for rising star badge).
   */
  async getTopWeeklyGainers(limit = 100): Promise<{ userId: string; weeklyXp: number }[]> {
    return this.userRanking.getTopWeeklyGainers(limit);
  }

  /**
   * Check if user is in top N percent of weekly earners using a single SQL query.
   * Returns true when the user's percentile rank is at or below the given threshold.
   *
   * Example: isUserInTopWeeklyPercent(userId, 5) returns true if the user is in
   * the top 5% of weekly XP earners.
   */
  async isUserInTopWeeklyPercent(userId: string, percent: number): Promise<boolean> {
    return this.userRanking.isUserInTopWeeklyPercent(userId, percent);
  }
}
