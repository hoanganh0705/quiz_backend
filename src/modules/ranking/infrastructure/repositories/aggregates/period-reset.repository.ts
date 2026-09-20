/**
 * Period Reset Repository
 *
 * Owns period-reset aggregate operations.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql, gt } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { userRanking } from '@/core/database/schema';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
import { RankingPeriod, getXpColumn } from '../../../domain/types/ranking.types';

@Injectable()
export class PeriodResetRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectPinoLogger(PeriodResetRepository.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
  ) {}

  private getDayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

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

  async resetPeriod(period: RankingPeriod, resetAt: Date): Promise<number> {
    if (period === RankingPeriod.ALL_TIME) {
      return 0;
    }

    const tx = (this.transactionalContext?.getDbClient() ?? this.db) as typeof this.db;

    const periodLockId =
      period === RankingPeriod.DAILY ? 0 : period === RankingPeriod.WEEKLY ? 1 : 2;

    await tx.execute(sql`SELECT pg_advisory_xact_lock(${periodLockId})`);

    const xpColumn = getXpColumn(period);
    const resetAtIso = resetAt.toISOString();

    const snapshotDate = this.getDayStart(resetAt);

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

    const resetFields = this.getResetFields(period);
    const resetResult = (await tx
      .update(userRanking)
      .set(resetFields.set(resetAtIso))
      .where(gt(resetFields.xpColumn, 0))) as unknown as {
      rowCount?: number | null;
    };

    return resetResult.rowCount ?? 0;
  }
}
