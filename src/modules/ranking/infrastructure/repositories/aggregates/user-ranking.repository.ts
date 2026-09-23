/**
 * User Ranking Repository
 *
 * Owns all user-ranking aggregate operations.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, desc, inArray, asc, count } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { userRanking, rankRecalculationWorkItems } from '@/core/database/schema';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
import type {
  UserRankingRow,
  UserRankingWithUserRow,
  PeakRanksRow,
} from '../../../domain/ports/ranking-repository.port';
import { RankingPeriod, getWeekStart, getMonthStart } from '../../../domain/types/ranking.types';

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
export class UserRankingRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(UserRankingRepository.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
  ) {}

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
    const dayStart = this.getDayStart(date);
    const lastReset = new Date(lastDailyResetAt);
    return dayStart > lastReset;
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
      default:
        throw new Error(`Unknown period: ${String(period)}`);
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
      default:
        throw new Error(`Unknown period: ${String(period)}`);
    }
  }

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
    const dayStart = this.getDayStart(new Date()).toISOString();

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

    const inserted = await tx
      .insert(userRanking)
      .values({
        userId,
        allTimeXp: 0,
        weeklyXp: 0,
        monthlyXp: 0,
        dailyXp: 0,
        lastWeeklyResetAt: sql`date_trunc('week', NOW() AT TIME ZONE 'UTC')`,
        lastMonthlyResetAt: sql`date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
        lastDailyResetAt: sql`date_trunc('day', NOW() AT TIME ZONE 'UTC')`,
        lastActivityAt: nowIso,
        isDirty: false,
      } as unknown as typeof userRanking.$inferInsert)
      .onConflictDoNothing({ target: userRanking.userId })
      .returning();

    const row =
      inserted[0] ??
      (await tx.query.userRanking.findFirst({
        where: eq(userRanking.userId, userId),
      }));

    if (!row) {
      throw new Error('Failed to upsert user ranking record');
    }

    const updated = await tx
      .update(userRanking)
      .set({
        allTimeXp: sql`${userRanking.allTimeXp} + ${amount}`,
        weeklyXp: sql`CASE
          WHEN ${userRanking.lastWeeklyResetAt} < date_trunc('week', NOW() AT TIME ZONE 'UTC')
            OR ${userRanking.lastMonthlyResetAt} < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN 0
          ELSE ${userRanking.weeklyXp} + ${amount}
        END`,
        monthlyXp: sql`CASE
          WHEN ${userRanking.lastMonthlyResetAt} < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN 0
          ELSE ${userRanking.monthlyXp} + ${amount}
        END`,
        dailyXp: sql`CASE
          WHEN ${userRanking.lastDailyResetAt} < date_trunc('day', NOW() AT TIME ZONE 'UTC')
          THEN 0
          ELSE ${userRanking.dailyXp} + ${amount}
        END`,
        lastWeeklyResetAt: sql`CASE
          WHEN ${userRanking.lastWeeklyResetAt} < date_trunc('week', NOW() AT TIME ZONE 'UTC')
            OR ${userRanking.lastMonthlyResetAt} < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN date_trunc('week', NOW() AT TIME ZONE 'UTC')
          ELSE ${userRanking.lastWeeklyResetAt}
        END`,
        lastMonthlyResetAt: sql`CASE
          WHEN ${userRanking.lastMonthlyResetAt} < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN date_trunc('month', NOW() AT TIME ZONE 'UTC')
          ELSE ${userRanking.lastMonthlyResetAt}
        END`,
        lastDailyResetAt: sql`CASE
          WHEN ${userRanking.lastDailyResetAt} < date_trunc('day', NOW() AT TIME ZONE 'UTC')
          THEN date_trunc('day', NOW() AT TIME ZONE 'UTC')
          ELSE ${userRanking.lastDailyResetAt}
        END`,
        lastActivityAt: nowIso,
        updatedAt: nowIso,
        isDirty: true,
      })
      .where(eq(userRanking.userId, userId))
      .returning();

    const result = updated[0];
    if (!result) {
      throw new Error('Failed to update user ranking row');
    }

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
    const rows = params.userIds.flatMap((userId) =>
      params.periods.map((period) => ({ userId, period })),
    );

    await tx
      .insert(rankRecalculationWorkItems)
      .values(rows)
      .onConflictDoNothing({
        target: [rankRecalculationWorkItems.userId, rankRecalculationWorkItems.period],
      });

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

  async completeRecalculationWorkItemsInTx(tx: unknown, workItemIds: string[]): Promise<void> {
    if (workItemIds.length === 0) return;

    const client = tx as typeof this.db;
    await client
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

  async countDirtyUsers(): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(userRanking)
      .where(eq(userRanking.isDirty, true));
    return Number(result[0]?.value ?? 0);
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

    const result = await this.executeClearDirtyFlags(userIds);
    const cleared = (result.rows as Array<{ userId: string }>).map((r) => r.userId);
    if (cleared.length > 0) {
      this.logger.debug({
        event: 'ranking_latch_cleared',
        usersCleared: cleared.length,
      });
    }
  }

  async clearDirtyFlagsForUsersWithNoPendingWorkInTx(
    tx: unknown,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;

    const client = tx as typeof this.db;
    const userIdsArray = sql.raw(
      `ARRAY[${userIds.map((id) => `'${id.replace(/'/g, "''")}'::uuid`).join(',')}]`,
    );

    await client.execute(sql`
      WITH users_with_pending AS (
        SELECT DISTINCT user_id
        FROM rank_recalculation_work_items
        WHERE user_id = ANY(${userIdsArray})
      ),
      users_to_clear AS (
        SELECT u.user_id
        FROM unnest(${userIdsArray}) AS u(user_id)
        LEFT JOIN users_with_pending p ON p.user_id = u.user_id
        WHERE p.user_id IS NULL
      )
      UPDATE user_ranking
      SET is_dirty = false
      WHERE user_id IN (SELECT user_id FROM users_to_clear)
    `);
  }

  private async executeClearDirtyFlags(
    userIds: string[],
  ): Promise<RawQueryResult<{ userId: string }>> {
    const userIdsArray = sql.raw(
      `ARRAY[${userIds.map((id) => `'${id.replace(/'/g, "''")}'::uuid`).join(',')}]`,
    );
    return this.db.execute(sql<{ userId: string }>`
      WITH users_with_pending AS (
        SELECT DISTINCT user_id
        FROM rank_recalculation_work_items
        WHERE user_id = ANY(${userIdsArray})
      ),
      users_to_clear AS (
        SELECT u.user_id
        FROM unnest(${userIdsArray}) AS u(user_id)
        LEFT JOIN users_with_pending p ON p.user_id = u.user_id
        WHERE p.user_id IS NULL
      )
      UPDATE user_ranking
      SET is_dirty = false
      WHERE user_id IN (SELECT user_id FROM users_to_clear)
      RETURNING user_id AS "userId"
    `);
  }

  async updateRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<number | null> {
    const { userId, period, rank } = params;

    const rankFieldName = this.getRankColumn(period);
    const current = await this.getUserRanking(userId);
    const previousRank = current?.[rankFieldName] ?? null;

    await this.db
      .update(userRanking)
      .set({ [rankFieldName]: rank })
      .where(eq(userRanking.userId, userId));

    return previousRank;
  }

  private getRankColumn(period: RankingPeriod): string {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'dailyRank';
      case RankingPeriod.WEEKLY:
        return 'weeklyRank';
      case RankingPeriod.MONTHLY:
        return 'monthlyRank';
      case RankingPeriod.ALL_TIME:
        return 'allTimeRank';
      default:
        throw new Error(`Unknown period: ${String(period)}`);
    }
  }

  async updatePeakRank(params: {
    userId: string;
    period: RankingPeriod;
    rank: number;
  }): Promise<{ updated: boolean; previousPeakRank: number | null }> {
    const { userId, period, rank } = params;

    const peakRankColumn = this.getPeakRankColumnSnakeCase(period);
    const peakAchievedAtColumn = this.getPeakAchievedAtColumnSnakeCase(period);

    const result = await this.executeRaw<{
      previousPeakRank: number | null;
      newPeakRank: number | null;
    }>(sql`
      UPDATE user_ranking
      SET ${sql.raw(peakRankColumn)} = ${rank},
          ${sql.raw(peakAchievedAtColumn)} = NOW()
      WHERE user_id = ${userId}::uuid
        AND (${sql.raw(peakRankColumn)} IS NULL OR ${sql.raw(peakRankColumn)} > ${rank})
      RETURNING
        ${sql.raw(peakRankColumn)} AS "newPeakRank"
    `);

    if (result.rows.length === 0) {
      const current = await this.getUserRanking(userId);
      return {
        updated: false,
        previousPeakRank: current ? (current[peakRankColumn as PeakRankField] ?? null) : null,
      };
    }

    const current = await this.getUserRanking(userId);
    return {
      updated: true,
      previousPeakRank: current?.[peakRankColumn as PeakRankField] ?? null,
    };
  }

  private getPeakRankColumnSnakeCase(period: RankingPeriod): string {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'peak_daily_rank';
      case RankingPeriod.WEEKLY:
        return 'peak_weekly_rank';
      case RankingPeriod.MONTHLY:
        return 'peak_monthly_rank';
      case RankingPeriod.ALL_TIME:
        return 'peak_all_time_rank';
      default:
        throw new Error(`Unknown period: ${String(period)}`);
    }
  }

  private getPeakAchievedAtColumnSnakeCase(period: RankingPeriod): string {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'peak_daily_rank_achieved_at';
      case RankingPeriod.WEEKLY:
        return 'peak_weekly_rank_achieved_at';
      case RankingPeriod.MONTHLY:
        return 'peak_monthly_rank_achieved_at';
      case RankingPeriod.ALL_TIME:
        return 'peak_all_time_rank_achieved_at';
      default:
        throw new Error(`Unknown period: ${String(period)}`);
    }
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

  async getUsersWithRanking(): Promise<string[]> {
    const results = await this.db.query.userRanking.findMany({
      columns: { userId: true },
      where: sql`${userRanking.allTimeXp} > 0`,
    });

    return results.map((r) => r.userId);
  }

  async findXpMismatches(): Promise<
    {
      userId: string;
      storedXp: number;
      expectedXp: number;
    }[]
  > {
    const result = await this.executeRaw<{
      userId: string;
      storedXp: number;
      expectedXp: number;
    }>(sql`
      WITH attempt_xp AS (
        SELECT
          qa.user_id        AS "userId",
          COALESCE(SUM(qa.xp_earned), 0)::bigint AS "earnedSum"
        FROM quiz_attempts qa
        WHERE qa.status IN ('completed', 'abandoned')
        GROUP BY qa.user_id
      ),
      ranked_with_integrity AS (
        SELECT
          ur.user_id        AS "userId",
          ur.weekly_xp      AS "weeklyXp",
          ur.monthly_xp     AS "monthlyXp",
          ur.all_time_xp    AS "allTimeXp"
        FROM user_ranking ur
        INNER JOIN users u ON u.user_id = ur.user_id
        WHERE u.deleted_at IS NULL
      )
      SELECT
        rwi."userId"           AS "userId",
        rwi."allTimeXp"        AS "storedXp",
        COALESCE(ax."earnedSum", 0)::integer AS "expectedXp"
      FROM ranked_with_integrity rwi
      LEFT JOIN attempt_xp ax ON ax."userId" = rwi."userId"
      WHERE
        rwi."weeklyXp" < 0
        OR rwi."monthlyXp" < 0
        OR rwi."allTimeXp" < 0
        OR rwi."weeklyXp" > rwi."allTimeXp"
        OR rwi."monthlyXp" > rwi."allTimeXp"
        OR rwi."allTimeXp" <> COALESCE(ax."earnedSum", 0)
    `);

    return result.rows.map((row) => ({
      userId: row.userId,
      storedXp: Number(row.storedXp),
      expectedXp: Number(row.expectedXp),
    }));
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

  async getInactiveUsers(daysInactive: number, limit = 100): Promise<UserRankingRow[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const results = await this.db.query.userRanking.findMany({
      where: sql`${userRanking.lastActivityAt} < ${cutoffDate.toISOString()}`,
      limit,
    });

    return results as UserRankingRow[];
  }

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

  async getActiveUsers(daysActive: number, limit = 100): Promise<UserRankingRow[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysActive);

    const results = await this.db.query.userRanking.findMany({
      where: sql`${userRanking.lastActivityAt} >= ${cutoffDate.toISOString()}`,
      limit,
    });

    return results as UserRankingRow[];
  }

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

  async isUserInTopWeeklyPercent(userId: string, percent: number): Promise<boolean> {
    const [userRow] = await this.db
      .select({ weeklyXp: userRanking.weeklyXp })
      .from(userRanking)
      .where(eq(userRanking.userId, userId))
      .limit(1);

    if (!userRow || userRow.weeklyXp === 0) return false;

    const userXp = userRow.weeklyXp;

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
}
