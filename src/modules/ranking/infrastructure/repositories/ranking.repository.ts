/**
 * Ranking Repository Implementation
 *
 * Implements the RankingRepositoryPort using Drizzle ORM.
 * Uses DENSE_RANK() and RANK() for proper tie handling.
 */

import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, desc, and, inArray, gte, lte, asc } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { userRanking, rankHistory, rankingMilestones } from '@/core/database/schema';
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
} from '../../domain/ports/ranking-repository.port';
import { RankingPeriod, RankingMilestone } from '../../domain/types/ranking.types';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

type PeakRankField = 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank';
type PeakAchievedAtField =
  | 'peakAllTimeRankAchievedAt'
  | 'peakWeeklyRankAchievedAt'
  | 'peakMonthlyRankAchievedAt';

@Injectable()
export class RankingRepository implements RankingRepositoryPort {
  constructor(
    @Inject('DATABASE')
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(RankingRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async getUserRanking(userId: string): Promise<UserRankingRow | null> {
    const result = await this.db.query.userRanking.findFirst({
      where: eq(userRanking.userId, userId),
    });

    return result as UserRankingRow | null;
  }

  async getUserRankingWithUser(userId: string): Promise<UserRankingWithUserRow | null> {
    const result = await this.executeRaw<UserRankingWithUserRow>(sql`
      SELECT
        ur.user_id as "userId",
        ur.all_time_xp as "allTimeXp",
        ur.weekly_xp as "weeklyXp",
        ur.monthly_xp as "monthlyXp",
        ur.all_time_rank as "allTimeRank",
        ur.weekly_rank as "weeklyRank",
        ur.monthly_rank as "monthlyRank",
        ur.last_weekly_reset_at as "lastWeeklyResetAt",
        ur.last_monthly_reset_at as "lastMonthlyResetAt",
        ur.peak_all_time_rank as "peakAllTimeRank",
        ur.peak_all_time_rank_achieved_at as "peakAllTimeRankAchievedAt",
        ur.peak_weekly_rank as "peakWeeklyRank",
        ur.peak_weekly_rank_achieved_at as "peakWeeklyRankAchievedAt",
        ur.peak_monthly_rank as "peakMonthlyRank",
        ur.peak_monthly_rank_achieved_at as "peakMonthlyRankAchievedAt",
        ur.last_activity_at as "lastActivityAt",
        ur.is_dirty as "isDirty",
        ur.updated_at as "updatedAt",
        u.username as "username",
        u.display_name as "displayName",
        u.avatar_url as "avatarUrl"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.user_id = ${userId}
      LIMIT 1
    `);

    return result.rows[0] ?? null;
  }

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    const now = new Date().toISOString();
    const weekStart = this.getWeekStart(new Date()).toISOString();
    const monthStart = this.getMonthStart(new Date()).toISOString();

    const [result] = await this.db
      .insert(userRanking)
      .values({
        userId,
        allTimeXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
        lastWeeklyResetAt: weekStart,
        lastMonthlyResetAt: monthStart,
        lastActivityAt: now,
        isDirty: false,
      })
      .returning();

    return result as UserRankingRow;
  }

  async updateXp(params: { userId: string; amount: number; now: Date }): Promise<UserRankingRow> {
    const { userId, amount, now } = params;

    const existing = await this.getUserRanking(userId);
    if (!existing) {
      await this.createUserRanking(userId);
    }

    const nowIso = now.toISOString();

    // Determine if period resets are needed
    const weeklyResetNeeded = this.shouldResetWeekly(now);
    const monthlyResetNeeded = this.shouldResetMonthly(now);

    // If monthly reset needed, also reset weekly
    const weeklyXp =
      weeklyResetNeeded || monthlyResetNeeded ? sql`0` : sql`${userRanking.weeklyXp} + ${amount}`;
    const weeklyResetAt =
      weeklyResetNeeded || monthlyResetNeeded ? nowIso : sql`${userRanking.lastWeeklyResetAt}`;

    const monthlyXp = monthlyResetNeeded ? sql`0` : sql`${userRanking.monthlyXp} + ${amount}`;
    const monthlyResetAt = monthlyResetNeeded ? nowIso : sql`${userRanking.lastMonthlyResetAt}`;

    const [result] = await this.db
      .update(userRanking)
      .set({
        allTimeXp: sql`${userRanking.allTimeXp} + ${amount}`,
        weeklyXp,
        monthlyXp,
        lastWeeklyResetAt: weeklyResetAt,
        lastMonthlyResetAt: monthlyResetAt,
        lastActivityAt: nowIso,
        updatedAt: nowIso,
        isDirty: true,
      })
      .where(eq(userRanking.userId, userId))
      .returning();

    return result as UserRankingRow;
  }

  async markDirty(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    await this.db
      .update(userRanking)
      .set({ isDirty: true })
      .where(inArray(userRanking.userId, userIds));
  }

  async getDirtyUsers(limit: number): Promise<UserRankingRow[]> {
    const results = await this.db.query.userRanking.findMany({
      where: eq(userRanking.isDirty, true),
      limit,
    });

    return results as UserRankingRow[];
  }

  async clearDirtyFlags(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    await this.db
      .update(userRanking)
      .set({ isDirty: false })
      .where(inArray(userRanking.userId, userIds));
  }

  async updateRank(params: { userId: string; period: RankingPeriod; rank: number }): Promise<number | null> {
    const { userId, period, rank } = params;

    const rankFieldName = this.getRankFieldName(period);
    const current = await this.getUserRanking(userId);
    const previousRank = current?.[rankFieldName] ?? null;

    await this.db
      .update(userRanking)
      .set({ [rankFieldName]: rank })
      .where(eq(userRanking.userId, userId));

    return previousRank;
  }

  async updatePeakRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<boolean> {
    const { userId, period, rank } = params;

    const peakRankColumn = this.getPeakRankColumn(period);
    const peakAchievedAtColumn = this.getPeakAchievedAtColumn(period);
    const current = await this.getUserRanking(userId);

    if (!current) return false;

    const currentPeakRank = current[peakRankColumn];

    if (currentPeakRank === null || rank < currentPeakRank) {
      await this.db
        .update(userRanking)
        .set({
          [peakRankColumn]: rank,
          [peakAchievedAtColumn]: new Date().toISOString(),
        })
        .where(eq(userRanking.userId, userId));

      return true;
    }

    return false;
  }

  async getPeakRanks(userId: string): Promise<PeakRanksRow> {
    const ranking = await this.getUserRanking(userId);

    if (!ranking) {
      return {
        daily: { rank: null, achievedAt: null },
        weekly: { rank: null, achievedAt: null },
        monthly: { rank: null, achievedAt: null },
        allTime: { rank: null, achievedAt: null },
      };
    }

    return {
      daily: { rank: null, achievedAt: null },
      weekly: {
        rank: ranking.peakWeeklyRank,
        achievedAt: ranking.peakWeeklyRankAchievedAt,
      },
      monthly: {
        rank: ranking.peakMonthlyRank,
        achievedAt: ranking.peakMonthlyRankAchievedAt,
      },
      allTime: {
        rank: ranking.peakAllTimeRank,
        achievedAt: ranking.peakAllTimeRankAchievedAt,
      },
    };
  }

  async getLeaderboard(params: {
    period: RankingPeriod;
    limit: number;
    offset: number;
  }): Promise<LeaderboardRow[]> {
    const { period, limit, offset } = params;
    const xpColumn = this.getXpColumn(period);

    // Use raw SQL with DENSE_RANK() for proper tie handling
    // DENSE_RANK() gives the same rank to tied users with no gaps
    // RANK() gives the same rank to tied users with gaps
    const results = await this.executeRaw<LeaderboardRow>(sql`
      SELECT
        u.user_id as "userId",
        u.display_name as "displayName",
        u.username as "username",
        u.avatar_url as "avatarUrl",
        ur.${sql.raw(xpColumn)} as xp,
        RANK() OVER (
          ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
        ) as rank,
        DENSE_RANK() OVER (
          ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
        ) as "denseRank"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
      ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return results.rows;
  }

  async getTotalParticipants(period: RankingPeriod): Promise<number> {
    const xpColumn = this.getXpColumn(period);

    const result = await this.executeRaw<{ count: number | string }>(sql`
      SELECT COUNT(*) as count
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
    `);

    return Number(result.rows[0]?.count ?? 0);
  }

  async getLeaderboardSize(period: RankingPeriod): Promise<number> {
    return this.getTotalParticipants(period);
  }

  async getUserRank(userId: string, period: RankingPeriod): Promise<number | null> {
    const xpColumn = this.getXpColumn(period);

    // Get user's XP first
    const user = await this.getUserRanking(userId);
    if (!user) return null;

    const userXp = user[this.getXpFieldName(period)];
    if (userXp === 0) return null;

    // Count users with higher XP
    const result = await this.executeRaw<{ rank: number | string }>(sql`
      SELECT COUNT(*) + 1 as rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > ${userXp}
        AND u.deleted_at IS NULL
    `);

    return Number(result.rows[0]?.rank ?? 0);
  }

  async getNextRankXp(period: RankingPeriod, currentRank: number): Promise<number | null> {
    const xpColumn = this.getXpColumn(period);

    // Get the XP at the next rank position
    const result = await this.executeRaw<{ xp: number | string }>(sql`
      SELECT ur.${sql.raw(xpColumn)} as xp
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
      ORDER BY ur.${sql.raw(xpColumn)} DESC
      LIMIT 1
      OFFSET ${currentRank}
    `);

    if (result.rows.length === 0) return null;
    return Number(result.rows[0]?.xp ?? 0);
  }

  async createRankHistory(params: {
    userId: string;
    period: RankingPeriod;
    snapshotDate: Date;
    rank: number;
    xp: number;
    recordedAt?: Date;
  }): Promise<RankHistoryRow> {
    const [result] = await this.db
      .insert(rankHistory)
      .values({
        userId: params.userId,
        period: params.period,
        snapshotDate: params.snapshotDate.toISOString(),
        rank: params.rank,
        xp: params.xp,
        recordedAt: params.recordedAt?.toISOString() ?? new Date().toISOString(),
      })
      .onConflictDoNothing()
      .returning();

    if (result) {
      return result as RankHistoryRow;
    }

    const existing = await this.db.query.rankHistory.findFirst({
      where: and(
        eq(rankHistory.userId, params.userId),
        eq(rankHistory.period, params.period),
        eq(rankHistory.snapshotDate, params.snapshotDate.toISOString()),
      ),
    });

    if (!existing) {
      throw new Error('Failed to persist rank history snapshot');
    }

    return existing as RankHistoryRow;
  }

  async getUserRankingHistory(params: {
    userId: string;
    period: RankingPeriod;
    from?: Date;
    to?: Date;
  }): Promise<RankHistoryRow[]> {
    const conditions = [eq(rankHistory.userId, params.userId), eq(rankHistory.period, params.period)];

    if (params.from) {
      conditions.push(gte(rankHistory.snapshotDate, params.from.toISOString()));
    }

    if (params.to) {
      conditions.push(lte(rankHistory.snapshotDate, params.to.toISOString()));
    }

    const results = await this.db.query.rankHistory.findMany({
      where: and(...conditions),
      orderBy: [asc(rankHistory.snapshotDate), asc(rankHistory.recordedAt)],
    });

    return results as RankHistoryRow[];
  }

  async getLatestRankSnapshots(params: {
    userId: string;
    period: RankingPeriod;
  }): Promise<import('../../domain/ports/ranking-repository.port').RankSnapshotPairRow> {
    const snapshots = await this.db.query.rankHistory.findMany({
      where: and(eq(rankHistory.userId, params.userId), eq(rankHistory.period, params.period)),
      orderBy: [desc(rankHistory.snapshotDate), desc(rankHistory.recordedAt)],
      limit: 2,
    });

    return {
      current: (snapshots[0] as RankHistoryRow | undefined) ?? null,
      previous: (snapshots[1] as RankHistoryRow | undefined) ?? null,
    };
  }

  async getTopMovers(params: { period: RankingPeriod; limit: number }): Promise<TopMoverRow[]> {
    const results = await this.executeRaw<TopMoverRow>(sql`
      WITH ranked_history AS (
        SELECT
          rh.user_id,
          rh.rank,
          rh.snapshot_date,
          rh.recorded_at,
          ROW_NUMBER() OVER (
            PARTITION BY rh.user_id
            ORDER BY rh.snapshot_date DESC, rh.recorded_at DESC
          ) AS snapshot_position
        FROM rank_history rh
        INNER JOIN users u ON u.user_id = rh.user_id
        WHERE rh.period = ${params.period}
          AND u.deleted_at IS NULL
      ),
      paired_snapshots AS (
        SELECT
          current_snapshot.user_id,
          current_snapshot.rank AS current_rank,
          previous_snapshot.rank AS previous_rank,
          previous_snapshot.rank - current_snapshot.rank AS change
        FROM ranked_history current_snapshot
        INNER JOIN ranked_history previous_snapshot
          ON previous_snapshot.user_id = current_snapshot.user_id
         AND previous_snapshot.snapshot_position = 2
        WHERE current_snapshot.snapshot_position = 1
      )
      SELECT
        paired_snapshots.user_id AS "userId",
        u.username AS username,
        paired_snapshots.current_rank AS "currentRank",
        paired_snapshots.previous_rank AS "previousRank",
        paired_snapshots.change AS change
      FROM paired_snapshots
      INNER JOIN users u ON u.user_id = paired_snapshots.user_id
      WHERE paired_snapshots.change > 0
        AND u.deleted_at IS NULL
      ORDER BY paired_snapshots.change DESC, paired_snapshots.current_rank ASC, u.username ASC
      LIMIT ${params.limit}
    `);

    return results.rows;
  }

  async getNearbyRanks(params: {
    userId: string;
    period: RankingPeriod;
    radius: number;
  }): Promise<{
    above: NearbyRankEntryRow[];
    me: NearbyRankEntryRow | null;
    below: NearbyRankEntryRow[];
  }> {
    const xpColumn = this.getXpColumn(params.period);

    const results = await this.executeRaw<NearbyRankEntryRow & { position: 'above' | 'me' | 'below' }>(sql`
      WITH ranked_users AS (
        SELECT
          u.user_id AS "userId",
          u.username AS username,
          ur.${sql.raw(xpColumn)} AS xp,
          RANK() OVER (
            ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
          ) AS rank
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE ur.${sql.raw(xpColumn)} > 0
          AND u.deleted_at IS NULL
      ),
      current_user AS (
        SELECT *
        FROM ranked_users
        WHERE "userId" = ${params.userId}
      )
      SELECT
        ranked_users.rank AS rank,
        ranked_users."userId" AS "userId",
        ranked_users.username AS username,
        ranked_users.xp AS xp,
        CASE
          WHEN ranked_users."userId" = current_user."userId" THEN 'me'
          WHEN ranked_users.rank < current_user.rank THEN 'above'
          ELSE 'below'
        END AS position
      FROM ranked_users
      CROSS JOIN current_user
      WHERE ranked_users.rank BETWEEN current_user.rank - ${params.radius} AND current_user.rank + ${params.radius}
      ORDER BY ranked_users.rank ASC, ranked_users.username ASC
    `);

    const me = results.rows.find((row) => row.position === 'me') ?? null;

    return {
      above: results.rows.filter((row) => row.position === 'above'),
      me,
      below: results.rows.filter((row) => row.position === 'below'),
    };
  }

  async createMilestone(params: {
    userId: string;
    milestone: RankingMilestone;
    rank: number;
    achievedAt: Date;
  }): Promise<RankingMilestoneRow> {
    const [result] = await this.db
      .insert(rankingMilestones)
      .values({
        userId: params.userId,
        milestone: params.milestone,
        rank: params.rank,
        achievedAt: params.achievedAt.toISOString(),
      })
      .onConflictDoNothing()
      .returning();

    if (result) {
      return result as RankingMilestoneRow;
    }

    const existing = await this.db.query.rankingMilestones.findFirst({
      where: and(
        eq(rankingMilestones.userId, params.userId),
        eq(rankingMilestones.milestone, params.milestone),
      ),
    });

    if (!existing) {
      throw new Error('Failed to persist ranking milestone');
    }

    return existing as RankingMilestoneRow;
  }

  async getUserMilestones(userId: string): Promise<RankingMilestoneRow[]> {
    const results = await this.db.query.rankingMilestones.findMany({
      where: eq(rankingMilestones.userId, userId),
      orderBy: [asc(rankingMilestones.achievedAt), asc(rankingMilestones.rank)],
    });

    return results as RankingMilestoneRow[];
  }

  async hasMilestone(params: { userId: string; milestone: RankingMilestone }): Promise<boolean> {
    const result = await this.db.query.rankingMilestones.findFirst({
      columns: { id: true },
      where: and(
        eq(rankingMilestones.userId, params.userId),
        eq(rankingMilestones.milestone, params.milestone),
      ),
    });

    return result !== undefined;
  }

  async getLeaderboardDistribution(period: RankingPeriod): Promise<LeaderboardDistributionRow> {
    const xpColumn = this.getXpColumn(period);

    const result = await this.executeRaw<{
      totalUsers: number | string;
      top10: number | string;
      top100: number | string;
      top1000: number | string;
      top10000: number | string;
    }>(sql`
      SELECT
        COUNT(*) AS "totalUsers",
        LEAST(COUNT(*), 10) AS "top10",
        LEAST(COUNT(*), 100) AS "top100",
        LEAST(COUNT(*), 1000) AS "top1000",
        LEAST(COUNT(*), 10000) AS "top10000"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
    `);

    const row = result.rows[0];
    const totalUsers = Number(row?.totalUsers ?? 0);
    const top10 = Number(row?.top10 ?? 0);
    const top100 = Number(row?.top100 ?? 0);
    const top1000 = Number(row?.top1000 ?? 0);
    const top10000 = Number(row?.top10000 ?? 0);

    const buckets = [
      { label: 'Top 10', count: top10 },
      { label: 'Top 100', count: Math.max(0, top100 - top10) },
      { label: 'Top 1000', count: Math.max(0, top1000 - top100) },
      { label: 'Top 10000', count: Math.max(0, top10000 - top1000) },
    ].filter((bucket) => bucket.count > 0);

    const remainingUsers = Math.max(0, totalUsers - top10000);

    return {
      totalUsers,
      remainingUsers,
      buckets,
    };
  }

  async resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number> {
    const xpColumn = this.getXpColumn(period);
    const rankColumn = this.getRankColumn(period);
    const resetColumn = this.getResetColumn(period);
    const rankFieldName = this.getRankFieldName(period);
    const resetAtIso = resetAt.toISOString();

    if (period === RankingPeriod.DAILY || period === RankingPeriod.ALL_TIME) {
      return 0;
    }

    const usersToArchive = await this.executeRaw<{
      userId: string;
      xp: number | string;
      rank: number | null;
    }>(sql`
      SELECT
        ur.user_id as "userId",
        ur.${sql.raw(xpColumn)} as xp,
        ur.${sql.raw(rankColumn)} as rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
    `);

    const snapshotDate = period === RankingPeriod.WEEKLY ? this.getWeekStart(resetAt) : this.getMonthStart(resetAt);

    for (const user of usersToArchive.rows) {
      const xpValue = Number(user.xp);
      const rankValue = user.rank;

      if (xpValue > 0 && rankValue !== null) {
        await this.createRankHistory({
          userId: user.userId,
          period,
          snapshotDate,
          rank: rankValue,
          xp: xpValue,
          recordedAt: resetAt,
        });
      }
    }

    const resetResult = (await this.db
      .update(userRanking)
      .set({
        [xpColumn]: 0,
        [rankFieldName]: null,
        [resetColumn]: resetAtIso,
        updatedAt: resetAtIso,
      })
      .where(sql`${userRanking[xpColumn as keyof typeof userRanking]} > 0`)) as unknown as {
      rowCount?: number | null;
    };

    return resetResult.rowCount ?? 0;
  }

  async getUsersWithRanking(): Promise<string[]> {
    const results = await this.db.query.userRanking.findMany({
      columns: { userId: true },
      where: sql`${userRanking.allTimeXp} > 0`,
    });

    return results.map((r) => r.userId);
  }

  findXpMismatches(): Promise<{ userId: string; storedXp: number; expectedXp: number }[]> {
    // This would compare stored XP with sum of events
    // Simplified implementation - in production, you'd track events
    return Promise.resolve([]);
  }

  async findMissingRanks(): Promise<string[]> {
    const result = await this.executeRaw<{ userId: string }>(sql`
      SELECT ur.user_id as "userId"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.all_time_xp > 0
        AND ur.all_time_rank IS NULL
        AND u.deleted_at IS NULL
    `);

    return result.rows.map((r) => r.userId);
  }

  // ============================================
  // Inactivity Support (Phase 4)
  // ============================================

  /**
   * Get users inactive for a certain period.
   */
  async getInactiveUsers(daysInactive: number, limit = 100): Promise<UserRankingRow[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const results = await this.db.query.userRanking.findMany({
      where: sql`${userRanking.lastActivityAt} < ${cutoffDate.toISOString()}`,
      limit,
    });

    return results as UserRankingRow[];
  }

  /**
   * Get user with their creation date for badge calculation.
   */
  async getUserWithCreationDate(userId: string): Promise<{
    ranking: UserRankingRow | null;
    createdAt: string;
  } | null> {
    const ranking = await this.getUserRanking(userId);

    const userResult = await this.executeRaw<{ createdAt: string }>(sql`
      SELECT created_at as "createdAt"
      FROM users
      WHERE user_id = ${userId}
    `);

    if (userResult.rows.length === 0) return null;

    return {
      ranking,
      createdAt: userResult.rows[0].createdAt,
    };
  }

  /**
   * Get users active in the last N days.
   */
  async getActiveUsers(daysActive: number, limit = 100): Promise<UserRankingRow[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysActive);

    const results = await this.db.query.userRanking.findMany({
      where: sql`${userRanking.lastActivityAt} >= ${cutoffDate.toISOString()}`,
      limit,
    });

    return results as UserRankingRow[];
  }

  /**
   * Get top weekly XP gainers (for rising star badge).
   */
  async getTopWeeklyGainers(limit = 100): Promise<{ userId: string; weeklyXp: number }[]> {
    const results = await this.db.query.userRanking.findMany({
      columns: {
        userId: true,
        weeklyXp: true,
      },
      where: sql`${userRanking.weeklyXp} > 0`,
      orderBy: desc(userRanking.weeklyXp),
      limit,
    });

    return results;
  }

  /**
   * Check if user is in top N percent of weekly earners.
   */
  async isUserInTopWeeklyPercent(userId: string, percent: number): Promise<boolean> {
    const userRankingData = await this.getUserRanking(userId);
    if (!userRankingData || userRankingData.weeklyXp === 0) return false;

    const topGainers = await this.getTopWeeklyGainers(1000);
    if (topGainers.length === 0) return false;

    const userIndex = topGainers.findIndex((g) => g.userId === userId);
    if (userIndex === -1) return false;

    const userPercent = (userIndex / topGainers.length) * 100;
    return userPercent <= percent;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getXpColumn(period: RankingPeriod): string {
    const mapping: Partial<Record<RankingPeriod, string>> = {
      [RankingPeriod.ALL_TIME]: 'all_time_xp',
      [RankingPeriod.WEEKLY]: 'weekly_xp',
      [RankingPeriod.MONTHLY]: 'monthly_xp',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily leaderboard is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'all_time_xp';
  }

  private getRankColumn(period: RankingPeriod): string {
    const mapping: Partial<Record<RankingPeriod, string>> = {
      [RankingPeriod.ALL_TIME]: 'all_time_rank',
      [RankingPeriod.WEEKLY]: 'weekly_rank',
      [RankingPeriod.MONTHLY]: 'monthly_rank',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily leaderboard is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'all_time_rank';
  }

  private getRankFieldName(period: RankingPeriod): 'allTimeRank' | 'weeklyRank' | 'monthlyRank' {
    const mapping: Partial<Record<RankingPeriod, 'allTimeRank' | 'weeklyRank' | 'monthlyRank'>> = {
      [RankingPeriod.ALL_TIME]: 'allTimeRank',
      [RankingPeriod.WEEKLY]: 'weeklyRank',
      [RankingPeriod.MONTHLY]: 'monthlyRank',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily leaderboard is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'allTimeRank';
  }

  private getPeakRankColumn(period: RankingPeriod): PeakRankField {
    const mapping: Partial<Record<RankingPeriod, PeakRankField>> = {
      [RankingPeriod.ALL_TIME]: 'peakAllTimeRank',
      [RankingPeriod.WEEKLY]: 'peakWeeklyRank',
      [RankingPeriod.MONTHLY]: 'peakMonthlyRank',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily peak rank is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'peakAllTimeRank';
  }

  private getPeakAchievedAtColumn(period: RankingPeriod): PeakAchievedAtField {
    const mapping: Partial<Record<RankingPeriod, PeakAchievedAtField>> = {
      [RankingPeriod.ALL_TIME]: 'peakAllTimeRankAchievedAt',
      [RankingPeriod.WEEKLY]: 'peakWeeklyRankAchievedAt',
      [RankingPeriod.MONTHLY]: 'peakMonthlyRankAchievedAt',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily peak achieved-at is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'peakAllTimeRankAchievedAt';
  }

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
  }

  private getResetColumn(period: RankingPeriod): string {
    const mapping: Partial<Record<RankingPeriod, string>> = {
      [RankingPeriod.ALL_TIME]: 'updatedAt',
      [RankingPeriod.WEEKLY]: 'lastWeeklyResetAt',
      [RankingPeriod.MONTHLY]: 'lastMonthlyResetAt',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily reset column is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'updatedAt';
  }

  private getXpFieldName(period: RankingPeriod): 'allTimeXp' | 'weeklyXp' | 'monthlyXp' {
    const mapping: Partial<Record<RankingPeriod, 'allTimeXp' | 'weeklyXp' | 'monthlyXp'>> = {
      [RankingPeriod.ALL_TIME]: 'allTimeXp',
      [RankingPeriod.WEEKLY]: 'weeklyXp',
      [RankingPeriod.MONTHLY]: 'monthlyXp',
    };

    if (period === RankingPeriod.DAILY) {
      throw new Error('Daily XP field is not supported by user_ranking snapshots');
    }

    return mapping[period] ?? 'allTimeXp';
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private shouldResetWeekly(date: Date): boolean {
    const weekStart = this.getWeekStart(date);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    return date >= weekStart && date < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  private shouldResetMonthly(date: Date): boolean {
    const monthStart = this.getMonthStart(date);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    return date.getDate() === 1 && date >= monthStart;
  }
}
