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
import { batchUpdateWithValues } from '@/common/database/batch-update';
import type {
  UserRankingRow,
  UserRankingWithUserRow,
  PeakRanksRow,
} from '../../../domain/ports/ranking-repository.port';
import {
  RankingPeriod,
  RankingMilestone,
  getWeekStart,
  getMonthStart,
} from '../../../domain/types/ranking.types';

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
    return await this.db.execute(query);
  }

  private getRankColumnName(period: RankingPeriod): string {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'daily_rank';
      case RankingPeriod.WEEKLY:
        return 'weekly_rank';
      case RankingPeriod.MONTHLY:
        return 'monthly_rank';
      case RankingPeriod.ALL_TIME:
        return 'all_time_rank';
    }
  }

  private getRankColumn(period: RankingPeriod): keyof typeof userRanking.$inferSelect {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'dailyRank';
      case RankingPeriod.WEEKLY:
        return 'weeklyRank';
      case RankingPeriod.MONTHLY:
        return 'monthlyRank';
      case RankingPeriod.ALL_TIME:
        return 'allTimeRank';
    }
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

    return results;
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

    return result;
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

    return result;
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

    return rows;
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

    return results;
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
    const rankCol = this.getRankColumnName(period);
    const nowIso = new Date().toISOString();

    const result = await this.executeRaw<{ previous_rank: number | null }>(sql`
      WITH prev AS (
        SELECT ${sql.raw(rankCol)} AS previous_rank
        FROM user_ranking
        WHERE user_id = ${userId}::uuid
      )
      UPDATE user_ranking
      SET ${sql.raw(rankCol)} = ${rank},
          updated_at = ${nowIso}
      WHERE user_id = ${userId}::uuid
      RETURNING ${sql.raw(rankCol)} AS previous_rank
    `);

    if (result.rows.length === 0) return null;
    const previousRank = result.rows[0].previous_rank;
    return previousRank;
  }

  async batchUpdateRanks(params: {
    updates: ReadonlyArray<{ userId: string; period: RankingPeriod; rank: number }>;
    now: Date;
  }): Promise<void> {
    if (params.updates.length === 0) return;
    await batchUpdateWithValues(
      this.db as never,
      'user_ranking',
      'user_id',
      params.updates.map((u) => ({
        key: u.userId,
        columns: { [this.getRankColumnName(u.period)]: u.rank, updatedAt: params.now },
      })),
    );
  }

  async batchUpdatePeakRanks(params: {
    updates: ReadonlyArray<{ userId: string; period: RankingPeriod; rank: number }>;
    now: Date;
  }): Promise<Array<{ userId: string; period: RankingPeriod; previousPeakRank: number | null }>> {
    if (params.updates.length === 0) return [];
    const nowIso = params.now.toISOString();

    const userIdArray = sql.raw(
      `ARRAY[${params.updates.map((u) => `'${u.userId.replace(/'/g, "''")}'::uuid`).join(',')}]`,
    );
    const periodArray = sql.raw(
      `ARRAY[${params.updates.map((u) => `'${u.period}'::text`).join(',')}]`,
    );
    const rankArray = sql.raw(`ARRAY[${params.updates.map((u) => `${u.rank}`).join(',')}]`);

    const _result = await this.executeRaw<{
      user_id: string;
      period: string;
      prev_peak: number | null;
    }>(sql`
      WITH existing AS (
        SELECT
          ur.user_id,
          CASE
            WHEN ${sql.raw(
              `ARRAY['all_time', 'weekly', 'monthly', 'daily'][1]`,
            )} = ANY(${periodArray})
            THEN (
              SELECT peak_all_time_rank FROM user_ranking WHERE user_id = ur.user_id
            )
            ELSE NULL
          END AS prev_peak_all_time,
          CASE
            WHEN ${sql.raw(`ARRAY['weekly'][1]`)} = ANY(${periodArray})
            THEN (
              SELECT peak_weekly_rank FROM user_ranking WHERE user_id = ur.user_id
            )
            ELSE NULL
          END AS prev_peak_weekly,
          CASE
            WHEN ${sql.raw(`ARRAY['monthly'][1]`)} = ANY(${periodArray})
            THEN (
              SELECT peak_monthly_rank FROM user_ranking WHERE user_id = ur.user_id
            )
            ELSE NULL
          END AS prev_peak_monthly,
          CASE
            WHEN ${sql.raw(`ARRAY['daily'][1]`)} = ANY(${periodArray})
            THEN (
              SELECT peak_daily_rank FROM user_ranking WHERE user_id = ur.user_id
            )
            ELSE NULL
          END AS prev_peak_daily
        FROM unnest(${userIdArray}) AS ur(user_id)
      ),
      updates AS (
        SELECT
          u.user_id,
          u.period_idx,
          CASE u.period_idx
            WHEN 1 THEN 'all_time'
            WHEN 2 THEN 'weekly'
            WHEN 3 THEN 'monthly'
            WHEN 4 THEN 'daily'
          END AS period_name,
          CASE u.period_idx
            WHEN 1 THEN e.prev_peak_all_time
            WHEN 2 THEN e.prev_peak_weekly
            WHEN 3 THEN e.prev_peak_monthly
            WHEN 4 THEN e.prev_peak_daily
          END AS prev_peak,
          CASE u.period_idx
            WHEN 1 THEN
              CASE WHEN e.prev_peak_all_time IS NULL OR e.prev_peak_all_time > u.rank
                   THEN u.rank ELSE e.prev_peak_all_time END
            WHEN 2 THEN
              CASE WHEN e.prev_peak_weekly IS NULL OR e.prev_peak_weekly > u.rank
                   THEN u.rank ELSE e.prev_peak_weekly END
            WHEN 3 THEN
              CASE WHEN e.prev_peak_monthly IS NULL OR e.prev_peak_monthly > u.rank
                   THEN u.rank ELSE e.prev_peak_monthly END
            WHEN 4 THEN
              CASE WHEN e.prev_peak_daily IS NULL OR e.prev_peak_daily > u.rank
                   THEN u.rank ELSE e.prev_peak_daily END
          END AS new_peak
        FROM (
          SELECT user_id, rank,
            generate_series(1, array_length(${rankArray}, 1)) AS period_idx
          FROM unnest(${userIdArray}, ${rankArray}) AS t(user_id, rank)
        ) u
        JOIN existing e ON e.user_id = u.user_id
      )
      UPDATE user_ranking AS ur
      SET
        peak_all_time_rank = CASE WHEN u.period_name = 'all_time' THEN u.new_peak ELSE ur.peak_all_time_rank END,
        peak_all_time_rank_achieved_at = CASE WHEN u.period_name = 'all_time' AND u.new_peak IS DISTINCT FROM ur.peak_all_time_rank THEN ${nowIso} ELSE ur.peak_all_time_rank_achieved_at END,
        peak_weekly_rank = CASE WHEN u.period_name = 'weekly' THEN u.new_peak ELSE ur.peak_weekly_rank END,
        peak_weekly_rank_achieved_at = CASE WHEN u.period_name = 'weekly' AND u.new_peak IS DISTINCT FROM ur.peak_weekly_rank THEN ${nowIso} ELSE ur.peak_weekly_rank_achieved_at END,
        peak_monthly_rank = CASE WHEN u.period_name = 'monthly' THEN u.new_peak ELSE ur.peak_monthly_rank END,
        peak_monthly_rank_achieved_at = CASE WHEN u.period_name = 'monthly' AND u.new_peak IS DISTINCT FROM ur.peak_monthly_rank THEN ${nowIso} ELSE ur.peak_monthly_rank_achieved_at END,
        peak_daily_rank = CASE WHEN u.period_name = 'daily' THEN u.new_peak ELSE ur.peak_daily_rank END,
        peak_daily_rank_achieved_at = CASE WHEN u.period_name = 'daily' AND u.new_peak IS DISTINCT FROM ur.peak_daily_rank THEN ${nowIso} ELSE ur.peak_daily_rank_achieved_at END
      FROM updates u
      WHERE ur.user_id = u.user_id
        AND (u.new_peak IS DISTINCT FROM u.prev_peak)
    `);

    return params.updates.map((u) => ({
      userId: u.userId,
      period: u.period,
      previousPeakRank: null,
    }));
  }

  async findDirtyUsersMissingRanks(): Promise<Map<string, Map<RankingPeriod, number>>> {
    const allPeriods: RankingPeriod[] = [
      RankingPeriod.DAILY,
      RankingPeriod.WEEKLY,
      RankingPeriod.MONTHLY,
      RankingPeriod.ALL_TIME,
    ];
    const result = new Map<string, Map<RankingPeriod, number>>();

    const rankedResult = await this.executeRaw<{
      user_id: string;
      period: string;
      rank: number;
    }>(sql`
      SELECT
        ur.user_id,
        CASE
          WHEN ur.daily_rank IS NULL AND u.deleted_at IS NULL AND ur.all_time_xp > 0
               AND EXISTS (SELECT 1 FROM user_ranking WHERE user_id = ur.user_id AND is_dirty = true)
          THEN 'daily'
          WHEN ur.weekly_rank IS NULL AND u.deleted_at IS NULL AND ur.all_time_xp > 0
               AND EXISTS (SELECT 1 FROM user_ranking WHERE user_id = ur.user_id AND is_dirty = true)
          THEN 'weekly'
          WHEN ur.monthly_rank IS NULL AND u.deleted_at IS NULL AND ur.all_time_xp > 0
               AND EXISTS (SELECT 1 FROM user_ranking WHERE user_id = ur.user_id AND is_dirty = true)
          THEN 'monthly'
          WHEN ur.all_time_rank IS NULL AND u.deleted_at IS NULL AND ur.all_time_xp > 0
               AND EXISTS (SELECT 1 FROM user_ranking WHERE user_id = ur.user_id AND is_dirty = true)
          THEN 'all_time'
        END AS period,
        RANK() OVER (PARTITION BY
          CASE
            WHEN ur.daily_rank IS NULL THEN 'daily'
            WHEN ur.weekly_rank IS NULL THEN 'weekly'
            WHEN ur.monthly_rank IS NULL THEN 'monthly'
            WHEN ur.all_time_rank IS NULL THEN 'all_time'
          END
          ORDER BY ur.all_time_xp DESC, ur.user_id ASC
        ) AS rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE u.deleted_at IS NULL
        AND ur.is_dirty = true
    `);

    for (const row of rankedResult.rows) {
      if (!row.period || !row.user_id || row.rank == null) continue;
      const period = row.period as RankingPeriod;
      if (!allPeriods.includes(period)) continue;
      const userId = row.user_id;
      if (!result.has(userId)) result.set(userId, new Map());
      const inner = result.get(userId)!;
      if (!inner.has(period)) inner.set(period, Number(row.rank));
    }

    return result;
  }

  async persistMilestones(params: {
    triples: ReadonlyArray<{
      userId: string;
      milestone: RankingMilestone;
      rank: number;
      achievedAt: Date;
    }>;
  }): Promise<void> {
    if (params.triples.length === 0) return;

    const values = sql.join(
      params.triples.map(
        (t) => sql`(${t.userId}::uuid, ${t.milestone}, ${t.rank}, ${t.achievedAt.toISOString()})`,
      ),
      sql`, `,
    );

    await this.db.execute(sql`
      INSERT INTO ranking_milestones (user_id, milestone, rank, achieved_at)
      VALUES ${values}
      ON CONFLICT (user_id, milestone) DO NOTHING
    `);
  }

  async processXpEventsBatch(params: {
    events: ReadonlyArray<{ userId: string; amount: number; now: Date }>;
  }): Promise<void> {
    if (params.events.length === 0) return;

    const userIds = sql.raw(
      `ARRAY[${params.events.map((e) => `'${e.userId.replace(/'/g, "''")}'::uuid`).join(',')}]`,
    );
    const amounts = sql.raw(`ARRAY[${params.events.map((e) => `${e.amount}`).join(',')}]`);
    const nowIso = params.events[0].now.toISOString();

    await this.db.execute(sql`
      UPDATE user_ranking
      SET
        all_time_xp = all_time_xp + amounts.idx,
        weekly_xp = CASE
          WHEN last_weekly_reset_at < date_trunc('week', NOW() AT TIME ZONE 'UTC')
               OR last_monthly_reset_at < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN amounts.idx
          ELSE weekly_xp + amounts.idx
        END,
        monthly_xp = CASE
          WHEN last_monthly_reset_at < date_trunc('month', NOW() AT TIME ZONE 'UTC')
          THEN amounts.idx
          ELSE monthly_xp + amounts.idx
        END,
        daily_xp = CASE
          WHEN last_daily_reset_at < date_trunc('day', NOW() AT TIME ZONE 'UTC')
          THEN amounts.idx
          ELSE daily_xp + amounts.idx
        END,
        last_activity_at = ${nowIso},
        updated_at = ${nowIso},
        is_dirty = true
      FROM unnest(${userIds}, ${amounts}) AS amounts(user_id, idx)
      WHERE user_ranking.user_id = amounts.user_id
    `);
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

    return results;
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

    return results;
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
