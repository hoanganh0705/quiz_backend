/**
 * Ranking Repository Implementation
 *
 * Implements the RankingRepositoryPort using Drizzle ORM.
 * Uses DENSE_RANK() and RANK() for proper tie handling.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, desc, and, inArray, gte, lte, asc, gt } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import {
  userRanking,
  rankHistory,
  rankingMilestones,
  rankRecalculationWorkItems,
} from '@/core/database/schema';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
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
import {
  RankingPeriod,
  RankingMilestone,
  getXpColumn,
  getRankFieldName,
  getResetColumn,
  getWeekStart,
  getMonthStart,
  getDayStart,
  getXpField,
} from '../../domain/types/ranking.types';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

type PeakRankField = 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank' | 'peakDailyRank';
type PeakAchievedAtField =
  | 'peakAllTimeRankAchievedAt'
  | 'peakWeeklyRankAchievedAt'
  | 'peakMonthlyRankAchievedAt'
  | 'peakDailyRankAchievedAt';

@Injectable()
export class RankingRepository implements RankingRepositoryPort {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(RankingRepository.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
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
        up.display_name as "displayName",
        up.avatar_url as "avatarUrl"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE ur.user_id = ${userId}
      LIMIT 1
    `);

    return result.rows[0] ?? null;
  }

  async getRankingsForUsers(userIds: string[]): Promise<UserRankingRow[]> {
    if (userIds.length === 0) return [];

    const results = await this.db.query.userRanking.findMany({
      where: inArray(userRanking.userId, userIds),
    });

    return results as UserRankingRow[];
  }

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    const now = new Date().toISOString();
    const weekStart = getWeekStart(new Date()).toISOString();
    const monthStart = getMonthStart(new Date()).toISOString();
    const dayStart = getDayStart(new Date()).toISOString();

    const [result] = await this.db
      .insert(userRanking)
      .values({
        userId,
        allTimeXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
        dailyXp: 0,
        lastWeeklyResetAt: weekStart,
        lastMonthlyResetAt: monthStart,
        lastDailyResetAt: dayStart,
        lastActivityAt: now,
        isDirty: false,
      } as any)
      .returning();

    return result as UserRankingRow;
  }

  async updateXp(params: { userId: string; amount: number; now: Date }): Promise<UserRankingRow> {
    const tx = (this.transactionalContext?.getDbClient() ?? this.db) as typeof this.db;
    return this._updateXpCore(tx, params);
  }

  async updateXpInTx(
    tx: unknown,
    params: { userId: string; amount: number; now: Date },
  ): Promise<UserRankingRow> {
    return this._updateXpCore(tx as typeof this.db, params);
  }

  private async _updateXpCore(
    tx: typeof this.db,
    params: { userId: string; amount: number; now: Date },
  ): Promise<UserRankingRow> {
    const { userId, amount, now } = params;
    const nowIso = now.toISOString();

    const existing = await tx.query.userRanking.findFirst({
      where: eq(userRanking.userId, userId),
    });

    if (!existing) {
      // Insert and immediately update within the same transaction scope.
      // Set lastWeeklyResetAt to previous week so the first XP event in a new
      // week correctly triggers a weekly reset via shouldResetWeekly().
      const prevWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      const prevMonthStart = getMonthStart(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      const prevDayStart = getDayStart(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      await tx.insert(userRanking).values({
        userId,
        allTimeXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
        dailyXp: 0,
        lastWeeklyResetAt: prevWeekStart.toISOString(),
        lastMonthlyResetAt: prevMonthStart.toISOString(),
        lastDailyResetAt: prevDayStart.toISOString(),
        lastActivityAt: nowIso,
        isDirty: false,
      } as any);

      const [afterInsert] = await tx
        .select()
        .from(userRanking)
        .where(eq(userRanking.userId, userId))
        .limit(1);

      if (!afterInsert) {
        throw new Error('Failed to create user ranking record');
      }

      // Re-read with the correct reset-tracking columns now that the row exists.
      const reRead = await tx.query.userRanking.findFirst({
        where: eq(userRanking.userId, userId),
      });

      if (!reRead) {
        throw new Error('Failed to re-read user ranking after insert');
      }

      const weeklyResetNeeded = this.shouldResetWeekly(now, reRead.lastWeeklyResetAt);
      const monthlyResetNeeded = this.shouldResetMonthly(now, reRead.lastMonthlyResetAt);
      const dailyResetNeeded = this.shouldResetDaily(now, (reRead as any).lastDailyResetAt);

      const [result] = await tx
        .update(userRanking)
        .set(
          dailyResetNeeded
            ? ({
                allTimeXp: sql`${userRanking.allTimeXp} + ${amount}`,
                weeklyXp:
                  weeklyResetNeeded || monthlyResetNeeded
                    ? sql`0`
                    : sql`${userRanking.weeklyXp} + ${amount}`,
                monthlyXp: monthlyResetNeeded ? sql`0` : sql`${userRanking.monthlyXp} + ${amount}`,
                ['dailyXp']: sql`0`,
                lastWeeklyResetAt:
                  weeklyResetNeeded || monthlyResetNeeded
                    ? nowIso
                    : sql`${userRanking.lastWeeklyResetAt}`,
                lastMonthlyResetAt: monthlyResetNeeded
                  ? nowIso
                  : sql`${userRanking.lastMonthlyResetAt}`,
                ['lastDailyResetAt']: nowIso,
                lastActivityAt: nowIso,
                updatedAt: nowIso,
                isDirty: true,
              } as any)
            : ({
                allTimeXp: sql`${userRanking.allTimeXp} + ${amount}`,
                weeklyXp:
                  weeklyResetNeeded || monthlyResetNeeded
                    ? sql`0`
                    : sql`${userRanking.weeklyXp} + ${amount}`,
                monthlyXp: monthlyResetNeeded ? sql`0` : sql`${userRanking.monthlyXp} + ${amount}`,
                ['dailyXp']: sql`${sql.raw('daily_xp')} + ${amount}`,
                lastWeeklyResetAt:
                  weeklyResetNeeded || monthlyResetNeeded
                    ? nowIso
                    : sql`${userRanking.lastWeeklyResetAt}`,
                lastMonthlyResetAt: monthlyResetNeeded
                  ? nowIso
                  : sql`${userRanking.lastMonthlyResetAt}`,
                ['lastDailyResetAt']: sql`${sql.raw('last_daily_reset_at')}`,
                lastActivityAt: nowIso,
                updatedAt: nowIso,
                isDirty: true,
              } as any),
        )
        .where(eq(userRanking.userId, userId))
        .returning();

      return result as UserRankingRow;
    }

    const weeklyResetNeeded = this.shouldResetWeekly(now, existing.lastWeeklyResetAt);
    const monthlyResetNeeded = this.shouldResetMonthly(now, existing.lastMonthlyResetAt);
    const dailyResetNeeded = this.shouldResetDaily(now, (existing as any).lastDailyResetAt);

    const [result] = await tx
      .update(userRanking)
      .set({
        allTimeXp: sql`${userRanking.allTimeXp} + ${amount}`,
        weeklyXp:
          weeklyResetNeeded || monthlyResetNeeded
            ? sql`0`
            : sql`${userRanking.weeklyXp} + ${amount}`,
        monthlyXp: monthlyResetNeeded ? sql`0` : sql`${userRanking.monthlyXp} + ${amount}`,
        ['dailyXp' as keyof typeof userRanking]: dailyResetNeeded
          ? sql`0`
          : sql`${sql.raw('daily_xp')} + ${amount}`,
        lastWeeklyResetAt:
          weeklyResetNeeded || monthlyResetNeeded ? nowIso : sql`${userRanking.lastWeeklyResetAt}`,
        lastMonthlyResetAt: monthlyResetNeeded ? nowIso : sql`${userRanking.lastMonthlyResetAt}`,
        ['lastDailyResetAt' as keyof typeof userRanking]: dailyResetNeeded
          ? nowIso
          : sql`${sql.raw('last_daily_reset_at')}`,
        lastActivityAt: nowIso,
        updatedAt: nowIso,
        isDirty: true,
      } as any)
      .where(eq(userRanking.userId, userId))
      .returning();

    return result as UserRankingRow;
  }

  async markDirty(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const tx = (this.transactionalContext?.getDbClient() ?? this.db) as typeof this.db;
    await this._markDirtyCore(tx, userIds);
  }

  async markDirtyInTx(tx: unknown, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this._markDirtyCore(tx as typeof this.db, userIds);
  }

  private async _markDirtyCore(tx: typeof this.db, userIds: string[]): Promise<void> {
    await tx.update(userRanking).set({ isDirty: true }).where(inArray(userRanking.userId, userIds));
  }

  async enqueueRecalculation(params: {
    userIds: string[];
    periods: RankingPeriod[];
  }): Promise<void> {
    if (params.userIds.length === 0 || params.periods.length === 0) return;
    const tx = (this.transactionalContext?.getDbClient() ?? this.db) as typeof this.db;
    await this._enqueueRecalculationCore(tx, params);
  }

  async enqueueRecalculationInTx(
    tx: unknown,
    params: { userIds: string[]; periods: RankingPeriod[] },
  ): Promise<void> {
    if (params.userIds.length === 0 || params.periods.length === 0) return;
    await this._enqueueRecalculationCore(tx as typeof this.db, params);
  }

  private async _enqueueRecalculationCore(
    tx: typeof this.db,
    params: { userIds: string[]; periods: RankingPeriod[] },
  ): Promise<void> {
    // ON CONFLICT (user_id, period) DO NOTHING — the unique index on
    // (user_id, period) makes the insert idempotent. Concurrent
    // enqueues for the same (user, period) pair produce exactly one
    // work-item row, so we cannot enqueue "twice" by accident.
    const rows = params.userIds.flatMap((userId) =>
      params.periods.map((period) => ({ userId, period })),
    );

    await tx
      .insert(rankRecalculationWorkItems)
      .values(rows)
      .onConflictDoNothing({
        target: [rankRecalculationWorkItems.userId, rankRecalculationWorkItems.period],
      });

    // Flip the per-user latch so fast existence checks see the dirty
    // flag. The latch is cheap to set even if already true.
    await tx
      .update(userRanking)
      .set({ isDirty: true })
      .where(inArray(userRanking.userId, params.userIds));
  }

  async getPendingRecalculationWorkItems(
    limit: number,
  ): Promise<Array<{ workItemId: string; userId: string; period: string }>> {
    const rows = await this.db
      .select({
        workItemId: rankRecalculationWorkItems.workItemId,
        userId: rankRecalculationWorkItems.userId,
        period: rankRecalculationWorkItems.period,
      })
      .from(rankRecalculationWorkItems)
      .orderBy(asc(rankRecalculationWorkItems.enqueuedAt))
      .limit(limit);

    return rows as Array<{ workItemId: string; userId: string; period: string }>;
  }

  async completeRecalculationWorkItems(workItemIds: string[]): Promise<void> {
    if (workItemIds.length === 0) return;

    await this.db
      .delete(rankRecalculationWorkItems)
      .where(inArray(rankRecalculationWorkItems.workItemId, workItemIds));
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

  async clearDirtyFlagsForUsersWithNoPendingWork(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    // Subquery: users in the input set that have no rows in the
    // work-items table. Single round-trip via a CTE.
    const result = await this.db.execute(sql<{ userId: string }>`
      WITH users_with_pending AS (
        SELECT DISTINCT user_id
        FROM rank_recalculation_work_items
        WHERE user_id = ANY(${userIds}::uuid[])
      ),
      users_to_clear AS (
        SELECT u.user_id
        FROM unnest(${userIds}::uuid[]) AS u(user_id)
        LEFT JOIN users_with_pending p ON p.user_id = u.user_id
        WHERE p.user_id IS NULL
      )
      UPDATE user_ranking
      SET is_dirty = false
      WHERE user_id IN (SELECT user_id FROM users_to_clear)
      RETURNING user_id AS "userId"
    `);

    const cleared = (result.rows as Array<{ userId: string }>).map((r) => r.userId);
    if (cleared.length > 0) {
      this.logger.debug({
        event: 'ranking_latch_cleared',
        usersCleared: cleared.length,
      });
    }
  }

  async updateRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<number | null> {
    const { userId, period, rank } = params;

    const rankFieldName = getRankFieldName(period);
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
  }): Promise<{ updated: boolean; previousPeakRank: number | null }> {
    const { userId, period, rank } = params;

    const peakRankColumn = this.getPeakRankColumn(period);
    const current = await this.getUserRanking(userId);

    if (!current) return { updated: false, previousPeakRank: null };

    const currentPeakRank = current[peakRankColumn];

    if (currentPeakRank === null || rank < currentPeakRank) {
      await this.db
        .update(userRanking)
        .set({
          [peakRankColumn]: rank,
          [this.getPeakAchievedAtColumn(period)]: new Date().toISOString(),
        })
        .where(eq(userRanking.userId, userId));

      return { updated: true, previousPeakRank: currentPeakRank };
    }

    return { updated: false, previousPeakRank: currentPeakRank };
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
      daily: {
        rank: ranking.peakDailyRank,
        achievedAt: ranking.peakDailyRankAchievedAt,
      },
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
    const xpColumn = getXpColumn(period);

    // Use raw SQL with DENSE_RANK() for proper tie handling
    // DENSE_RANK() gives the same rank to tied users with no gaps
    // RANK() gives the same rank to tied users with gaps
    // `display_name` and `avatar_url` live on `user_profiles`, not `users`,
    // so we LEFT JOIN the profile table. The fall back to `username` happens
    // in the application layer (`transformLeaderboardEntries`) — the SQL
    // returns NULL when a profile is missing and lets the DTO surface that.
    const results = await this.executeRaw<LeaderboardRow>(sql`
      SELECT
        u.user_id as "userId",
        up.display_name as "displayName",
        u.username as "username",
        up.avatar_url as "avatarUrl",
        ur.${sql.raw(xpColumn)} as xp,
        RANK() OVER (
          ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
        ) as rank,
        DENSE_RANK() OVER (
          ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
        ) as "denseRank"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
      ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return results.rows;
  }

  async getTotalParticipants(period: RankingPeriod): Promise<number> {
    const xpColumn = getXpColumn(period);

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
    const xpColumn = getXpColumn(period);

    // Get user's XP first
    const user = await this.getUserRanking(userId);
    if (!user) return null;

    const userXp = user[getXpField(period)];
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
    if (currentRank <= 0) return null;

    const xpColumn = getXpColumn(period);

    // Find the minimum XP among all users with a strictly better rank (rank < currentRank).
    // This is the XP threshold the user needs to cross to move up.
    // Using MIN avoids the off-by-one error that OFFSET causes with tied ranks.
    const result = await this.executeRaw<{ xp: number | string | null }>(sql`
      SELECT MIN(ur.${sql.raw(xpColumn)}) AS xp
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
        AND ur.${sql.raw(xpColumn)} < (
          SELECT ur2.${sql.raw(xpColumn)}
          FROM user_ranking ur2
          INNER JOIN users u2 ON u2.user_id = ur2.user_id
          WHERE ur2.${sql.raw(xpColumn)} > 0
            AND u2.deleted_at IS NULL
          ORDER BY ur2.${sql.raw(xpColumn)} DESC
          LIMIT 1
          OFFSET ${currentRank - 1}
        )
    `);

    const xp = result.rows[0]?.xp;
    return xp === null || xp === undefined ? null : Number(xp);
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
    const conditions = [
      eq(rankHistory.userId, params.userId),
      eq(rankHistory.period, params.period),
    ];

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

  async getNearbyRanks(params: { userId: string; period: RankingPeriod; radius: number }): Promise<{
    above: NearbyRankEntryRow[];
    me: NearbyRankEntryRow | null;
    below: NearbyRankEntryRow[];
  }> {
    const xpColumn = this.getXpColumn(params.period);

    // `current_user` is a reserved identifier in PostgreSQL (CURRENT_USER
    // returns the current session user), so we name the CTE `target_user`
    // to keep the planner happy.
    const results = await this.executeRaw<
      NearbyRankEntryRow & { position: 'above' | 'me' | 'below' }
    >(sql`
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
      target_user AS (
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
          WHEN ranked_users."userId" = target_user."userId" THEN 'me'
          WHEN ranked_users.rank < target_user.rank THEN 'above'
          ELSE 'below'
        END AS position
      FROM ranked_users
      CROSS JOIN target_user
      WHERE ranked_users.rank BETWEEN target_user.rank - ${params.radius} AND target_user.rank + ${params.radius}
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
    const xpColumn = getXpColumn(period);

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

  async calculateAllRanksForUsers(params: {
    userIds: string[];
    period: RankingPeriod;
  }): Promise<{ userId: string; xp: number; rank: number; denseRank: number }[]> {
    if (params.userIds.length === 0) return [];

    const xpColumn = getXpColumn(params.period);

    const result = await this.executeRaw<{
      userId: string;
      xp: number | string;
      rank: number | string;
      denseRank: number | string;
    }>(sql`
      WITH target_users AS (
        SELECT ur.user_id, ur.${sql.raw(xpColumn)} as xp
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE ur.user_id = ANY(${params.userIds})
          AND ur.${sql.raw(xpColumn)} > 0
          AND u.deleted_at IS NULL
      ),
      global_ranks AS (
        SELECT
          tu.user_id,
          tu.xp,
          RANK() OVER (ORDER BY tu.xp DESC, u.created_at ASC) as rank,
          DENSE_RANK() OVER (ORDER BY tu.xp DESC, u.created_at ASC) as dense_rank
        FROM target_users tu
        INNER JOIN users u ON u.user_id = tu.user_id
      )
      SELECT
        user_id as "userId",
        xp,
        rank,
        dense_rank as "denseRank"
      FROM global_ranks
    `);

    return result.rows.map((row) => ({
      userId: row.userId,
      xp: Number(row.xp),
      rank: Number(row.rank),
      denseRank: Number(row.denseRank),
    }));
  }

  async calculateAllRanks(period: RankingPeriod): Promise<
    {
      userId: string;
      xp: number;
      rank: number;
      denseRank: number;
    }[]
  > {
    const xpColumn = getXpColumn(period);

    const result = await this.executeRaw<{
      userId: string;
      xp: number | string;
      rank: number | string;
      denseRank: number | string;
    }>(sql`
      WITH ranked AS (
        SELECT
          ur.user_id as "userId",
          ur.${sql.raw(xpColumn)} as xp,
          RANK() OVER (
            ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
          ) as rank,
          DENSE_RANK() OVER (
            ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC
          ) as dense_rank
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE ur.${sql.raw(xpColumn)} > 0
          AND u.deleted_at IS NULL
      )
      SELECT * FROM ranked
    `);

    return result.rows.map((row) => ({
      userId: row.userId,
      xp: Number(row.xp),
      rank: Number(row.rank),
      denseRank: Number(row.denseRank),
    }));
  }

  async countRankAbove(xp: number, period: RankingPeriod): Promise<number> {
    const xpColumn = getXpColumn(period);

    const result = await this.executeRaw<{ rank: number | string }>(sql`
      SELECT COUNT(*) + 1 as rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > ${xp}
        AND u.deleted_at IS NULL
    `);

    return Number((result.rows[0] as { rank: number | string } | undefined)?.rank ?? 0) || 0;
  }

  async resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number> {
    if (period === RankingPeriod.ALL_TIME) {
      return 0;
    }

    // Use existing transaction if one is already open, otherwise open a new one.
    const tx = (this.transactionalContext?.getDbClient() ?? this.db) as typeof this.db;

    // Acquire a period-scoped advisory lock so concurrent resets for the same
    // period serialize. Different periods proceed in parallel.
    // IDs: DAILY=0, WEEKLY=1, MONTHLY=2
    const periodLockId =
      period === RankingPeriod.DAILY ? 0 : period === RankingPeriod.WEEKLY ? 1 : 2;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${periodLockId})`);

    const xpColumn = getXpColumn(period);
    const resetAtIso = resetAt.toISOString();

    const snapshotDate = getDayStart(resetAt);

    // Archive every user's current rank to rank_history in a single bulk
    // INSERT ... SELECT. The unique constraint
    //   uq_rank_history_user_period_snapshot (user_id, period, snapshot_date)
    // plus ON CONFLICT DO NOTHING makes this idempotent: if the process is
    // killed mid-reset and a new reset attempt is made for the same
    // snapshot_date, the archive rows are not duplicated.
    await tx.execute(sql`
      INSERT INTO rank_history (user_id, period, snapshot_date, rank, xp, recorded_at)
      SELECT
        ur.user_id,
        ${period}::text,
        ${snapshotDate.toISOString()}::timestamptz,
        ur.${sql.raw(xpColumn.replace('_xp', '_rank'))},
        ur.${sql.raw(xpColumn)},
        ${resetAtIso}::timestamptz
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND ur.${sql.raw(xpColumn.replace('_xp', '_rank'))} IS NOT NULL
        AND u.deleted_at IS NULL
      ON CONFLICT (user_id, period, snapshot_date) DO NOTHING
    `);

    // Reset XP and rank for all active users in one atomic UPDATE.
    //
    // Both the SET and WHERE clauses are dispatched on the period so we use
    // typed drizzle column references. The previous implementation used a
    // dynamic-key SET (`{ [xpColumn]: 0 }`) plus a raw `sql\`${column} > 0\``
    // WHERE template. Drizzle silently dropped the dynamic SET keys (they're
    // not typed column references), and the raw WHERE template emitted a
    // malformed `where  > 0` clause under certain paths, causing the manual
    // `/admin/ranking/reset` endpoint to 500 (see audit L-04).
    const resetFields = this.getResetFields(period);
    const resetResult = (await tx
      .update(userRanking)
      .set(resetFields.set(resetAtIso))
      .where(gt(resetFields.xpColumn, 0))) as unknown as {
      rowCount?: number | null;
    };

    return resetResult.rowCount ?? 0;
  }

  /**
   * Period-specific reset fields and target column for `resetPeriod`.
   *
   * Returns:
   *   - `xpColumn` — the typed XP column to compare in the WHERE clause
   *   - `set(resetAtIso)` — a builder that produces the typed SET clause for
   *     this period, zeroing the XP column, clearing the rank column, and
   *     stamping the reset timestamp + `updatedAt`.
   *
   * The return type is intentionally narrowed to `allTimeXp` / `allTimeRank`
   * / `lastWeeklyResetAt` literals because drizzle's `PgColumn` carries its
   * `name` as a literal type parameter, and TS can't unify different columns
   * into a discriminated union. Each branch casts to a common base.
   */
  private getResetFields(period: RankingPeriod): {
    xpColumn: typeof userRanking.allTimeXp;
    set: (resetAtIso: string) => Record<string, unknown>;
  } {
    switch (period) {
      case RankingPeriod.WEEKLY: {
        const xpColumn = userRanking.weeklyXp as unknown as typeof userRanking.allTimeXp;
        return {
          xpColumn,
          set: (resetAtIso) => ({
            weeklyXp: 0,
            weeklyRank: null,
            lastWeeklyResetAt: resetAtIso,
            updatedAt: resetAtIso,
          }),
        };
      }
      case RankingPeriod.MONTHLY: {
        const xpColumn = userRanking.monthlyXp as unknown as typeof userRanking.allTimeXp;
        return {
          xpColumn,
          set: (resetAtIso) => ({
            monthlyXp: 0,
            monthlyRank: null,
            lastMonthlyResetAt: resetAtIso,
            updatedAt: resetAtIso,
          }),
        };
      }
      case RankingPeriod.DAILY: {
        const xpColumn = userRanking.dailyXp as unknown as typeof userRanking.allTimeXp;
        return {
          xpColumn,
          set: (resetAtIso) => ({
            dailyXp: 0,
            dailyRank: null,
            lastDailyResetAt: resetAtIso,
            updatedAt: resetAtIso,
          }),
        };
      }
      case RankingPeriod.ALL_TIME:
      default: {
        const xpColumn = userRanking.allTimeXp;
        return {
          xpColumn,
          set: (resetAtIso) => ({
            allTimeXp: 0,
            allTimeRank: null,
            updatedAt: resetAtIso,
          }),
        };
      }
    }
  }

  async getUsersWithRanking(): Promise<string[]> {
    const results = await this.db.query.userRanking.findMany({
      columns: { userId: true },
      where: sql`${userRanking.allTimeXp} > 0`,
    });

    return results.map((r) => r.userId);
  }

  /**
   * Find users with impossible XP state.
   *
   * Detects two categories of corruption:
   * 1. Negative or zero XP in any field — physically impossible.
   * 2. Period XP exceeding all-time XP — would only happen if all-time was
   *    incorrectly reset while the period XP column was not updated atomically.
   *
   * Also cross-references stored allTimeXp against the sum of completed
   * quiz_attempt.xpEarned events to catch any delta that was applied
   * to userRanking but never recorded in quizAttempts (or vice versa).
   */
  async findXpMismatches(): Promise<
    {
      userId: string;
      storedXp: number;
      expectedXp: number;
    }[]
  > {
    // Layer 1: flag negative/zero XP and period > all-time (immediate corruption).
    const integrityResult = await this.executeRaw<{
      userId: string;
      weeklyXp: number;
      monthlyXp: number;
      allTimeXp: number;
    }>(sql`
      SELECT
        ur.user_id       AS "userId",
        ur.weekly_xp    AS "weeklyXp",
        ur.monthly_xp    AS "monthlyXp",
        ur.all_time_xp   AS "allTimeXp"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE u.deleted_at IS NULL
        AND (
          ur.weekly_xp < 0
          OR ur.monthly_xp < 0
          OR ur.all_time_xp < 0
          OR ur.weekly_xp > ur.all_time_xp
          OR ur.monthly_xp > ur.all_time_xp
        )
    `);

    // Layer 2: allTimeXp vs sum of completed quiz_attempt events.
    const eventsResult = await this.executeRaw<{
      userId: string;
      allTimeXp: number;
      earned_sum: number;
    }>(sql`
      SELECT
        ur.user_id               AS "userId",
        ur.all_time_xp           AS "allTimeXp",
        COALESCE(SUM(qa.xp_earned), 0) AS earned_sum
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      LEFT JOIN quiz_attempts qa
        ON qa.user_id = ur.user_id
        AND qa.status IN ('completed', 'abandoned')
      WHERE u.deleted_at IS NULL
      GROUP BY ur.user_id, ur.all_time_xp
      HAVING ur.all_time_xp <> COALESCE(SUM(qa.xp_earned), 0)
    `);

    const mismatches: { userId: string; storedXp: number; expectedXp: number }[] = [];

    for (const row of integrityResult.rows) {
      // Use the quiz_attempts sum as the authoritative expected value.
      const eventsRow = eventsResult.rows.find((e) => e.userId === row.userId);
      const expectedXp = eventsRow ? Number(eventsRow.earned_sum) : row.allTimeXp;
      mismatches.push({ userId: row.userId, storedXp: row.allTimeXp, expectedXp });
    }

    for (const row of eventsResult.rows) {
      if (mismatches.some((m) => m.userId === row.userId)) continue;
      mismatches.push({
        userId: row.userId,
        storedXp: Number(row.allTimeXp),
        expectedXp: Number(row.earned_sum),
      });
    }

    return mismatches;
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
   * Check if user is in top N percent of weekly earners using a single SQL query.
   * Returns true when the user's percentile rank is at or below the given threshold.
   *
   * Example: isUserInTopWeeklyPercent(userId, 5) returns true if the user is in
   * the top 5% of weekly XP earners.
   */
  async isUserInTopWeeklyPercent(userId: string, percent: number): Promise<boolean> {
    // Fetch the user's weekly XP in a single query.
    const [userRow] = await this.db
      .select({ weeklyXp: userRanking.weeklyXp })
      .from(userRanking)
      .where(eq(userRanking.userId, userId))
      .limit(1);

    if (!userRow || userRow.weeklyXp === 0) return false;

    const userXp = userRow.weeklyXp;

    // Single query: compare the user's XP percentile against the threshold.
    // Counts users with strictly more weekly XP than this user, then divides by the
    // total active count to get a percentile — no in-memory array, no N+1.
    const result = await this.executeRaw<{ below_count: number; total_count: number }>(sql`
      WITH total AS (
        SELECT COUNT(*) AS cnt
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE ur.weekly_xp > 0 AND u.deleted_at IS NULL
      ),
      below AS (
        SELECT COUNT(*) AS cnt
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE ur.weekly_xp > ${userXp} AND u.deleted_at IS NULL
      )
      SELECT below.cnt AS below_count,
             total.cnt AS total_count
      FROM total, below
    `);

    const belowCount = Number(result.rows[0]?.below_count ?? 0);
    const totalCount = Number(result.rows[0]?.total_count ?? 0);

    if (totalCount === 0) return false;

    const userPercentile = (belowCount / totalCount) * 100;
    return userPercentile <= percent;
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

  private getPeakRankColumn(period: RankingPeriod): PeakRankField {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'peakDailyRank';
      case RankingPeriod.WEEKLY:
        return 'peakWeeklyRank';
      case RankingPeriod.MONTHLY:
        return 'peakMonthlyRank';
      case RankingPeriod.ALL_TIME:
        return 'peakAllTimeRank';
    }
  }

  private getPeakAchievedAtColumn(period: RankingPeriod): PeakAchievedAtField {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'peakDailyRankAchievedAt';
      case RankingPeriod.WEEKLY:
        return 'peakWeeklyRankAchievedAt';
      case RankingPeriod.MONTHLY:
        return 'peakMonthlyRankAchievedAt';
      case RankingPeriod.ALL_TIME:
        return 'peakAllTimeRankAchievedAt';
    }
  }

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
  }

  private getDayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private shouldResetWeekly(date: Date, lastWeeklyResetAt: string | null | undefined): boolean {
    if (!lastWeeklyResetAt) return false;
    const weekStart = getWeekStart(date);
    const lastReset = new Date(lastWeeklyResetAt);
    return weekStart > lastReset;
  }

  private shouldResetMonthly(date: Date, lastMonthlyResetAt: string | null | undefined): boolean {
    if (!lastMonthlyResetAt) return false;
    const monthStart = getMonthStart(date);
    const lastReset = new Date(lastMonthlyResetAt);
    return monthStart > lastReset;
  }

  private shouldResetDaily(date: Date, lastDailyResetAt: string | null | undefined): boolean {
    if (!lastDailyResetAt) return false;
    const dayStart = getDayStart(date);
    const lastReset = new Date(lastDailyResetAt);
    return dayStart > lastReset;
  }
}
