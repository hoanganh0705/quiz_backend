/**
 * Leaderboard Repository
 *
 * Owns leaderboard-query and rank-calculation aggregate operations.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import type {
  LeaderboardRow,
  NearbyRankEntryRow,
  LeaderboardDistributionRow,
} from '../../../domain/ports/ranking-repository.port';
import { RankingPeriod, getXpField, getXpColumn } from '../../../domain/types/ranking.types';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

@Injectable()
export class LeaderboardRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(LeaderboardRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
  }

  async getLeaderboard(params: {
    period: RankingPeriod;
    limit: number;
    offset: number;
  }): Promise<LeaderboardRow[]> {
    const { period, limit, offset } = params;
    const xpColumn = getXpColumn(period);

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

  async getLeaderboardKeyset(params: {
    period: RankingPeriod;
    limit: number;
    cursorXp?: number | null;
    cursorCreatedAt?: string | null;
    cursorUserId?: string | null;
  }): Promise<LeaderboardRow[]> {
    const { period, limit, cursorXp, cursorCreatedAt, cursorUserId } = params;
    const xpColumn = getXpColumn(period);

    const hasCursor =
      cursorXp !== null &&
      cursorXp !== undefined &&
      cursorCreatedAt !== null &&
      cursorCreatedAt !== undefined &&
      cursorUserId !== null &&
      cursorUserId !== undefined;

    const cursorPredicate = hasCursor
      ? sql`(
          ur.${sql.raw(xpColumn)} < ${cursorXp}
          OR (ur.${sql.raw(xpColumn)} = ${cursorXp} AND u.created_at > ${cursorCreatedAt}::timestamptz)
          OR (
            ur.${sql.raw(xpColumn)} = ${cursorXp}
            AND u.created_at = ${cursorCreatedAt}::timestamptz
            AND u.user_id > ${cursorUserId}::uuid
          )
        )`
      : sql`TRUE`;

    const results = await this.executeRaw<LeaderboardRow>(sql`
      SELECT
        u.user_id as "userId",
        up.display_name as "displayName",
        u.username as "username",
        up.avatar_url as "avatarUrl",
        ur.${sql.raw(xpColumn)} as xp,
        u.created_at as "createdAt",
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
        AND ${cursorPredicate}
      ORDER BY ur.${sql.raw(xpColumn)} DESC, u.created_at ASC, u.user_id ASC
      LIMIT ${limit}
    `);

    return results.rows.map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      username: row.username,
      avatarUrl: row.avatarUrl,
      xp: row.xp,
      rank: row.rank,
      denseRank: row.denseRank,
    }));
  }

  async getLeaderboardCursorFirstPage(params: {
    period: RankingPeriod;
    limit: number;
  }): Promise<LeaderboardRow[]> {
    return this.getLeaderboardKeyset({
      period: params.period,
      limit: params.limit,
      cursorXp: null,
      cursorCreatedAt: null,
      cursorUserId: null,
    });
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

    const [userRow] = await this.db
      .select({
        weeklyXp: schema.userRanking.weeklyXp,
        allTimeXp: schema.userRanking.allTimeXp,
        monthlyXp: schema.userRanking.monthlyXp,
        dailyXp: schema.userRanking.dailyXp,
      })
      .from(schema.userRanking)
      .where(eq(schema.userRanking.userId, userId))
      .limit(1);

    if (!userRow) return null;

    const userXp = userRow[getXpField(period)];
    if (userXp === 0) return null;

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

    const result = await this.executeRaw<{ xp: number | string | null }>(sql`
      WITH ranked_users AS (
        SELECT
          ${sql.raw(xpColumn)} AS xp,
          RANK() OVER (ORDER BY ${sql.raw(xpColumn)} DESC, user_id ASC) AS rank
        FROM user_ranking
        WHERE ${sql.raw(xpColumn)} > 0
          AND user_id IN (
            SELECT user_id FROM users WHERE deleted_at IS NULL
          )
      ),
      target_user AS (
        SELECT xp FROM ranked_users WHERE rank = ${currentRank}
      ),
      next_rank_users AS (
        SELECT MIN(xp) AS xp
        FROM ranked_users
        WHERE rank < ${currentRank}
          AND xp > (SELECT xp FROM target_user)
      )
      SELECT xp FROM next_rank_users
    `);

    const xp = result.rows[0]?.xp;
    return xp === null || xp === undefined ? null : Number(xp);
  }

  async getNearbyRanks(params: { userId: string; period: RankingPeriod; radius: number }): Promise<{
    above: NearbyRankEntryRow[];
    me: NearbyRankEntryRow | null;
    below: NearbyRankEntryRow[];
  }> {
    const xpColumn = getXpColumn(params.period);

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
    const userIdsArray = sql.raw(
      `ARRAY[${params.userIds.map((id) => `'${id.replace(/'/g, "''")}'::uuid`).join(',')}]`,
    );

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
        WHERE ur.user_id = ANY(${userIdsArray})
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
}
