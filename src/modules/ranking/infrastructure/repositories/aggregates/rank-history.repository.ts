/**
 * Rank History Repository
 *
 * Owns rank-history aggregate operations.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, desc, and, asc, gte, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { rankHistory } from '@/core/database/schema';
import type {
  RankHistoryRow,
  TopMoverRow,
  RankSnapshotPairRow,
} from '../../../domain/ports/ranking-repository.port';
import { RankingPeriod } from '../../../domain/types/ranking.types';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

@Injectable()
export class RankHistoryRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(RankHistoryRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
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
  }): Promise<RankSnapshotPairRow> {
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
}
