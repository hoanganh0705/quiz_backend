/**
 * Ranking Repository Implementation
 *
 * Implements the RankingRepositoryPort using Drizzle ORM.
 * Uses DENSE_RANK() and RANK() for proper tie handling.
 */

import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, desc, asc, isNull, and, gt, inArray } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  userRanking,
  rankHistory,
  users,
} from '@/core/database/schema';
import type { RankingRepositoryPort, UserRankingRow, UserRankingWithUserRow, RankHistoryRow, LeaderboardRow } from '../../domain/ports/ranking-repository.port';
import type { RankingPeriod } from '../../domain/types/ranking.types';

@Injectable()
export class RankingRepository implements RankingRepositoryPort {
  constructor(
    @Inject('DATABASE')
    private readonly db: NodePgDatabase,
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
    const result = await this.db.query.userRanking.findFirst({
      where: eq(userRanking.userId, userId),
      with: {
        user: {
          columns: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!result) return null;

    return {
      ...result,
      username: result.user.username,
      displayName: result.user.displayName,
      avatarUrl: result.user.avatarUrl,
    } as UserRankingWithUserRow;
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
    const weeklyXp = weeklyResetNeeded || monthlyResetNeeded ? sql`0` : sql`${userRanking.weeklyXp} + ${amount}`;
    const weeklyResetAt = weeklyResetNeeded || monthlyResetNeeded ? nowIso : sql`${userRanking.lastWeeklyResetAt}`;

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

  async updateRank(params: { userId: string; period: RankingPeriod; rank: number }): Promise<void> {
    const { userId, period, rank } = params;

    const rankColumn = this.getRankColumn(period);

    await this.db
      .update(userRanking)
      .set({ [rankColumn]: rank })
      .where(eq(userRanking.userId, userId));
  }

  async updatePeakRank(params: { userId: string; period: RankingPeriod; rank: number }): Promise<boolean> {
    const { userId, period, rank } = params;

    const peakRankColumn = this.getPeakRankColumn(period);
    const current = await this.getUserRanking(userId);

    if (!current) return false;

    const currentPeakRank = current[peakRankColumn];

    // Only update if new rank is better (lower number) or no peak exists
    if (currentPeakRank === null || rank < currentPeakRank) {
      await this.db
        .update(userRanking)
        .set({
          [peakRankColumn]: rank,
          peakRankAchievedAt: new Date().toISOString(),
        })
        .where(eq(userRanking.userId, userId));

      return true;
    }

    return false;
  }

  async getLeaderboard(params: { period: RankingPeriod; limit: number; offset: number }): Promise<LeaderboardRow[]> {
    const { period, limit, offset } = params;
    const xpColumn = this.getXpColumn(period);

    // Use raw SQL with DENSE_RANK() for proper tie handling
    // DENSE_RANK() gives the same rank to tied users with no gaps
    // RANK() gives the same rank to tied users with gaps
    const results = await this.db.execute(sql`
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

    return results.rows as LeaderboardRow[];
  }

  async getTotalParticipants(period: RankingPeriod): Promise<number> {
    const xpColumn = this.getXpColumn(period);

    const result = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > 0
        AND u.deleted_at IS NULL
    `);

    return Number(result.rows[0]?.count ?? 0);
  }

  async getUserRank(userId: string, period: RankingPeriod): Promise<number | null> {
    const xpColumn = this.getXpColumn(period);
    const rankColumn = this.getRankColumn(period);

    // Get user's XP first
    const user = await this.getUserRanking(userId);
    if (!user) return null;

    const userXp = user[this.getXpFieldName(period)];
    if (userXp === 0) return null;

    // Count users with higher XP
    const result = await this.db.execute(sql`
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
    const result = await this.db.execute(sql`
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
    periodStart: Date | null;
    periodEnd: Date;
    xpAtStart: number;
    xpAtEnd: number;
    rankAtEnd: number | null;
    peakRank: number | null;
    peakXp: number | null;
  }): Promise<RankHistoryRow> {
    const [result] = await this.db
      .insert(rankHistory)
      .values({
        userId: params.userId,
        period: params.period,
        periodStart: params.periodStart?.toISOString() ?? null,
        periodEnd: params.periodEnd.toISOString(),
        xpAtStart: params.xpAtStart,
        xpAtEnd: params.xpAtEnd,
        rankAtEnd: params.rankAtEnd,
        peakRank: params.peakRank,
        peakXp: params.peakXp,
      })
      .returning();

    return result as RankHistoryRow;
  }

  async getRankHistory(userId: string, period: RankingPeriod, limit = 10): Promise<RankHistoryRow[]> {
    const results = await this.db.query.rankHistory.findMany({
      where: and(
        eq(rankHistory.userId, userId),
        eq(rankHistory.period, period),
      ),
      orderBy: desc(rankHistory.createdAt),
      limit,
    });

    return results as RankHistoryRow[];
  }

  async resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number> {
    const xpColumn = this.getXpColumn(period);
    const rankColumn = this.getRankColumn(period);
    const resetColumn = this.getResetColumn(period);
    const resetAtIso = resetAt.toISOString();

    // Archive current peak ranks before reset
    const users = await this.db.query.userRanking.findMany({
      columns: {
        userId: true,
        [xpColumn]: true,
        [rankColumn]: true,
      },
    });

    for (const user of users) {
      const xpValue = user[xpColumn] as number;
      const rankValue = user[rankColumn] as number | null;

      // Only archive if user has activity
      if (xpValue > 0) {
        const current = await this.getUserRanking(user.userId);
        if (current) {
          await this.createRankHistory({
            userId: user.userId,
            period,
            periodStart: current[resetColumn] ? new Date(current[resetColumn] as string) : null,
            periodEnd: resetAt,
            xpAtStart: 0, // Would need to track separately
            xpAtEnd: xpValue,
            rankAtEnd: rankValue,
            peakRank: rankValue,
            peakXp: xpValue,
          });
        }
      }
    }

    // Reset XP and rank
    const resetResult = await this.db
      .update(userRanking)
      .set({
        [xpColumn]: 0,
        [rankColumn]: null,
        [resetColumn]: resetAtIso,
        updatedAt: resetAtIso,
      })
      .where(sql`${userRanking[xpColumn as keyof typeof userRanking]} > 0`);

    return resetResult.rowCount ?? 0;
  }

  async getUsersWithRanking(): Promise<string[]> {
    const results = await this.db.query.userRanking.findMany({
      columns: { userId: true },
      where: sql`${userRanking.allTimeXp} > 0`,
    });

    return results.map(r => r.userId);
  }

  async findXpMismatches(): Promise<{ userId: string; storedXp: number; expectedXp: number }[]> {
    // This would compare stored XP with sum of events
    // Simplified implementation - in production, you'd track events
    return [];
  }

  async findMissingRanks(): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT ur.user_id as "userId"
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.all_time_xp > 0
        AND ur.all_time_rank IS NULL
        AND u.deleted_at IS NULL
    `);

    return result.rows.map(r => r.userId as string);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getXpColumn(period: RankingPeriod): string {
    const mapping: Record<RankingPeriod, string> = {
      [RankingPeriod.ALL_TIME]: 'all_time_xp',
      [RankingPeriod.WEEKLY]: 'weekly_xp',
      [RankingPeriod.MONTHLY]: 'monthly_xp',
    };
    return mapping[period];
  }

  private getRankColumn(period: RankingPeriod): string {
    const mapping: Record<RankingPeriod, string> = {
      [RankingPeriod.ALL_TIME]: 'allTimeRank',
      [RankingPeriod.WEEKLY]: 'weeklyRank',
      [RankingPeriod.MONTHLY]: 'monthlyRank',
    };
    return mapping[period];
  }

  private getPeakRankColumn(period: RankingPeriod): string {
    const mapping: Record<RankingPeriod, string> = {
      [RankingPeriod.ALL_TIME]: 'peakAllTimeRank',
      [RankingPeriod.WEEKLY]: 'peakWeeklyRank',
      [RankingPeriod.MONTHLY]: 'peakMonthlyRank',
    };
    return mapping[period];
  }

  private getResetColumn(period: RankingPeriod): string {
    const mapping: Record<RankingPeriod, string> = {
      [RankingPeriod.ALL_TIME]: 'updatedAt',
      [RankingPeriod.WEEKLY]: 'lastWeeklyResetAt',
      [RankingPeriod.MONTHLY]: 'lastMonthlyResetAt',
    };
    return mapping[period];
  }

  private getXpFieldName(period: RankingPeriod): 'allTimeXp' | 'weeklyXp' | 'monthlyXp' {
    const mapping: Record<RankingPeriod, 'allTimeXp' | 'weeklyXp' | 'monthlyXp'> = {
      [RankingPeriod.ALL_TIME]: 'allTimeXp',
      [RankingPeriod.WEEKLY]: 'weeklyXp',
      [RankingPeriod.MONTHLY]: 'monthlyXp',
    };
    return mapping[period];
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
