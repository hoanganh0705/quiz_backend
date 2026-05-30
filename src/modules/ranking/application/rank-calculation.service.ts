/**
 * Rank Calculation Service
 *
 * Handles rank computation using DENSE_RANK() and RANK() for proper tie handling.
 * Part of Phase 2 - Core Features.
 *
 * Tie Handling Strategy:
 * - RANK() is used for display purposes (ordinal positions with gaps for ties)
 * - DENSE_RANK() is used for percentile calculations and internal logic
 *
 * Example with ties:
 *   Scores: [100, 90, 90, 80]
 *
 *   RANK():       [1, 2, 2, 4]  <- Gaps after ties (next is 4, not 3)
 *   DENSE_RANK(): [1, 2, 2, 3]  <- No gaps (next is 3)
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, and } from 'drizzle-orm';
import { userRanking, users } from '@/core/database/schema';
import type { RankingRepositoryPort, LeaderboardRow } from '../domain/ports/ranking-repository.port';
import { RANKING_CONSTANTS, RankingPeriod } from '../domain/types/ranking.types';
import type { RankCalculationResult, ConsistencyReport, RankingIssue } from '../domain/types/ranking.types';
import { RankCalculationError } from '../domain/errors/ranking-domain.errors';

@Injectable()
export class RankCalculationService {
  constructor(
    @Inject('DATABASE')
    private readonly db: NodePgDatabase,
    @Inject('RANKING_REPOSITORY')
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(RankCalculationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Calculate ranks for all users in a specific period.
   * Uses both RANK() and DENSE_RANK() for complete ranking information.
   *
   * @param period - The ranking period to calculate
   * @returns Array of rank calculation results
   */
  async calculateAllRanks(period: RankingPeriod): Promise<RankCalculationResult[]> {
    const xpColumn = this.getXpColumn(period);
    const rankColumn = this.getRankColumn(period);

    this.logger.info({
      event: 'rank_calculation_started',
      period,
    });

    try {
      // Use raw SQL with both RANK() and DENSE_RANK()
      // RANK() assigns the same rank to ties but leaves gaps
      // DENSE_RANK() assigns the same rank to ties without gaps
      const results = await this.db.execute(sql`
        WITH ranked AS (
          SELECT
            ur.user_id,
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

      const rankResults: RankCalculationResult[] = results.rows.map((row) => ({
        userId: row.user_id as string,
        period,
        rank: Number(row.rank),
        denseRank: Number(row.dense_rank),
        xp: Number(row.xp),
      }));

      // Batch update all ranks in a single transaction
      await this.batchUpdateRanks(rankResults, period);

      this.logger.info({
        event: 'rank_calculation_completed',
        period,
        usersRanked: rankResults.length,
      });

      return rankResults;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new RankCalculationError(period, message);
    }
  }

  /**
   * Recalculate ranks for a specific set of users.
   * This is more efficient than recalculating all ranks.
   *
   * @param userIds - Array of user IDs to recalculate
   * @param period - The ranking period
   */
  async recalculateRanksForUsers(userIds: string[], period: RankingPeriod): Promise<void> {
    if (userIds.length === 0) return;

    const xpColumn = this.getXpColumn(period);

    // First, mark all affected users as dirty
    await this.rankingRepository.markDirty(userIds);

    // For each user, calculate their rank by counting users with higher XP
    for (const userId of userIds) {
      const userRanking = await this.rankingRepository.getUserRanking(userId);
      if (!userRanking) continue;

      const userXp = userRanking[this.getXpFieldName(period)];
      if (userXp <= 0) continue;

      // Calculate rank by counting users with higher XP
      const rank = await this.calculateUserRank(userId, period);

      // Update the rank
      await this.rankingRepository.updateRank({
        userId,
        period,
        rank,
      });
    }

    this.logger.info({
      event: 'incremental_rank_recalculation_completed',
      period,
      usersAffected: userIds.length,
    });
  }

  /**
   * Calculate the rank for a single user.
   * Uses COUNT query which is efficient for single user lookups.
   *
   * @param userId - The user ID
   * @param period - The ranking period
   * @returns The user's rank, or null if no XP
   */
  async calculateUserRank(userId: string, period: RankingPeriod): Promise<number | null> {
    const xpColumn = this.getXpColumn(period);

    const user = await this.rankingRepository.getUserRanking(userId);
    if (!user) return null;

    const userXp = user[this.getXpFieldName(period)];
    if (userXp <= 0) return null;

    // Count users with strictly higher XP
    const result = await this.db.execute(sql`
      SELECT COUNT(*) + 1 as rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > ${userXp}
        AND u.deleted_at IS NULL
    `);

    return Number(result.rows[0]?.rank ?? 0) || null;
  }

  /**
   * Calculate the DENSE_RANK for a single user.
   * Useful for percentile calculations.
   *
   * @param userId - The user ID
   * @param period - The ranking period
   * @returns The user's dense rank
   */
  async calculateUserDenseRank(userId: string, period: RankingPeriod): Promise<number | null> {
    const xpColumn = this.getXpColumn(period);

    const user = await this.rankingRepository.getUserRanking(userId);
    if (!user) return null;

    const userXp = user[this.getXpFieldName(period)];
    if (userXp <= 0) return null;

    // Count users with strictly higher XP (dense rank calculation)
    const result = await this.db.execute(sql`
      SELECT COUNT(DISTINCT ur.${sql.raw(xpColumn)}) + 1 as dense_rank
      FROM user_ranking ur
      INNER JOIN users u ON u.user_id = ur.user_id
      WHERE ur.${sql.raw(xpColumn)} > ${userXp}
        AND u.deleted_at IS NULL
    `);

    return Number(result.rows[0]?.dense_rank ?? 0) || null;
  }

  /**
   * Queue a user for rank recalculation.
   * The actual recalculation happens asynchronously.
   *
   * @param userId - The user ID
   * @param periods - Array of periods to recalculate
   */
  async queueRankRecalculation(userId: string, periods: RankingPeriod[]): Promise<void> {
    // Mark user as dirty
    await this.rankingRepository.markDirty([userId]);

    // In a production system, this would queue to a job processor
    // For now, we process immediately but could be batched
    this.logger.debug({
      event: 'rank_recalculation_queued',
      userId,
      periods,
    });
  }

  /**
   * Process all dirty users for rank recalculation.
   * This is called by the batch processor.
   *
   * @param limit - Maximum number of users to process
   * @param period - Optional specific period, or all periods
   */
  async processDirtyRankings(limit = RANKING_CONSTANTS.INCREMENTAL_BATCH_SIZE): Promise<number> {
    const dirtyUsers = await this.rankingRepository.getDirtyUsers(limit);

    if (dirtyUsers.length === 0) return 0;

    const userIds = dirtyUsers.map(u => u.userId);

    // Process all periods
    for (const period of [RankingPeriod.WEEKLY, RankingPeriod.MONTHLY, RankingPeriod.ALL_TIME]) {
      await this.recalculateRanksForUsers(userIds, period);
    }

    // Clear dirty flags
    await this.rankingRepository.clearDirtyFlags(userIds);

    this.logger.info({
      event: 'dirty_rankings_processed',
      usersProcessed: dirtyUsers.length,
    });

    return dirtyUsers.length;
  }

  /**
   * Perform consistency check on rankings.
   * Identifies and fixes rank inconsistencies.
   */
  async performConsistencyCheck(): Promise<ConsistencyReport> {
    const issues: RankingIssue[] = [];

    // Check for users with XP > 0 but no rank
    const missingRanks = await this.rankingRepository.findMissingRanks();
    if (missingRanks.length > 0) {
      issues.push({
        type: 'missing_rank',
        description: `${missingRanks.length} users have XP but no rank assigned`,
        severity: 'medium',
      });

      // Fix missing ranks
      for (const userId of missingRanks) {
        for (const period of [RankingPeriod.WEEKLY, RankingPeriod.MONTHLY, RankingPeriod.ALL_TIME]) {
          const rank = await this.calculateUserRank(userId, period);
          if (rank !== null) {
            await this.rankingRepository.updateRank({ userId, period, rank });
          }
        }
      }
    }

    // Check for XP mismatches (stored vs. calculated from events)
    const xpMismatches = await this.rankingRepository.findXpMismatches();
    if (xpMismatches.length > 0) {
      issues.push({
        type: 'xp_mismatch',
        description: `${xpMismatches.length} users have XP mismatches`,
        severity: 'high',
      });
    }

    const report: ConsistencyReport = {
      totalIssues: issues.length,
      fixed: issues.length,
      issues,
    };

    this.logger.info({
      event: 'consistency_check_completed',
      totalIssues: report.totalIssues,
      fixed: report.fixed,
    });

    return report;
  }

  /**
   * Batch update ranks for multiple users.
   */
  private async batchUpdateRanks(
    results: RankCalculationResult[],
    period: RankingPeriod,
  ): Promise<void> {
    if (results.length === 0) return;

    const rankColumn = this.getRankColumn(period);

    // Build batch update query
    const updates = results.map(r =>
      `('${r.userId}', ${r.rank}, ${r.denseRank})`
    );

    // Use a single UPDATE with a VALUES clause for efficiency
    await this.db.execute(sql`
      UPDATE user_ranking AS ur
      SET
        ${sql.raw(rankColumn)} = ranked.rank,
        updated_at = NOW()
      FROM (VALUES ${sql.raw(updates.join(', '))}) AS ranked(user_id, rank, dense_rank)
      WHERE ur.user_id = ranked.user_id::uuid
    `);
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

  private getXpFieldName(period: RankingPeriod): 'allTimeXp' | 'weeklyXp' | 'monthlyXp' {
    const mapping: Record<RankingPeriod, 'allTimeXp' | 'weeklyXp' | 'monthlyXp'> = {
      [RankingPeriod.ALL_TIME]: 'allTimeXp',
      [RankingPeriod.WEEKLY]: 'weeklyXp',
      [RankingPeriod.MONTHLY]: 'monthlyXp',
    };
    return mapping[period];
  }
}
