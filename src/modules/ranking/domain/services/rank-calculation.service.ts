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
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../ports/ranking-event-bus.port';
import {
  RANKING_CONSTANTS,
  RankingMilestone,
  RankingPeriod,
  calculatePercentile,
  getXpField,
} from '../types/ranking.types';
import type {
  RankCalculationResult,
  ConsistencyReport,
  RankingIssue,
} from '../types/ranking.types';
import { RankCalculationError } from '../errors/ranking-domain.errors';

@Injectable()
export class RankCalculationService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(RankCalculationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Calculate ranks for all users in a specific period.
   * Uses both RANK() and DENSE_RANK() for complete ranking information.
   */
  async calculateAllRanks(period: RankingPeriod): Promise<RankCalculationResult[]> {
    this.logger.info({
      event: 'rank_calculation_started',
      period,
    });

    try {
      const rankResults = await this.rankingRepository.calculateAllRanks(period);

      const results: RankCalculationResult[] = rankResults.map((row) => ({
        userId: row.userId,
        period,
        rank: row.rank,
        denseRank: row.denseRank,
        xp: row.xp,
      }));

      await this.batchUpdateRanks(results, period);

      this.logger.info({
        event: 'rank_calculation_completed',
        period,
        usersRanked: results.length,
      });

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new RankCalculationError(period, message);
    }
  }

  /**
   * Recalculate ranks for a specific set of users.
   * Uses a single window-function query instead of per-user loops.
   */
  async recalculateRanksForUsers(userIds: string[], period: RankingPeriod): Promise<void> {
    if (userIds.length === 0) return;

    await this.rankingRepository.markDirty(userIds);

    const ranked = await this.rankingRepository.calculateAllRanksForUsers({
      userIds,
      period,
    });

    await this.batchUpdateRanksForUsers(ranked, period);

    this.logger.info({
      event: 'incremental_rank_recalculation_completed',
      period,
      usersAffected: userIds.length,
    });
  }

  /**
   * Calculate the rank for a single user.
   */
  async calculateUserRank(
    userId: string,
    period: RankingPeriod,
    userXp?: number | null,
  ): Promise<number | null> {
    if (userXp === undefined || userXp === null) {
      const user = await this.rankingRepository.getUserRanking(userId);
      if (!user) return null;
      userXp = user[getXpField(period)];
    }

    if (userXp <= 0) return null;

    const count = await this.rankingRepository.countRankAbove(userXp, period);
    return count || null;
  }

  /**
   * Queue a user for rank recalculation across one or more periods.
   *
   * Idempotency: enqueueRecalculation inserts into
   * `rank_recalculation_work_items` with `ON CONFLICT (user_id, period)
   * DO NOTHING`, so two concurrent calls for the same (user, period)
   * pair produce exactly one work item. The batch processor picks each
   * pair up at most once per enqueue.
   */
  async queueRankRecalculation(userId: string, periods: RankingPeriod[]): Promise<void> {
    await this.rankingRepository.enqueueRecalculation({ userIds: [userId], periods });

    this.logger.debug({
      event: 'rank_recalculation_queued',
      userId,
      periods,
    });
  }

  /**
   * Like `queueRankRecalculation` but accepts an explicit transaction client.
   * Used by XpIngestionService to participate in the atomic XP + outbox transaction.
   */
  async queueRankRecalculationInTx(
    tx: unknown,
    userId: string,
    periods: RankingPeriod[],
  ): Promise<void> {
    await this.rankingRepository.enqueueRecalculationInTx(tx, { userIds: [userId], periods });

    this.logger.debug({
      event: 'rank_recalculation_queued',
      userId,
      periods,
    });
  }

  /**
   * Process all pending rank recalculation work items.
   *
   * Idempotency model: each work item is one (user, period) pair. The
   * unique index on (user_id, period) makes enqueue idempotent, and
   * `completeRecalculationWorkItems` deletes the work item by ID after
   * the recompute succeeds, so the same item is never processed twice.
   * A work item that gets re-enqueued mid-batch (because a new XP event
   * fired while we were computing) is a brand-new row with a new
   * `workItemId`; the previous one is gone. The `is_dirty` latch on
   * `user_ranking` is cleared only when the user has no more pending
   * work items.
   */
  async processDirtyRankings(limit = RANKING_CONSTANTS.INCREMENTAL_BATCH_SIZE): Promise<number> {
    const workItems = await this.rankingRepository.getPendingRecalculationWorkItems(limit);

    if (workItems.length === 0) return 0;

    // Group work items by period so we can recalculate each period
    // in one pass over the (much smaller) set of users for that period.
    const byPeriod = new Map<string, string[]>();
    for (const wi of workItems) {
      const list = byPeriod.get(wi.period) ?? [];
      list.push(wi.userId);
      byPeriod.set(wi.period, list);
    }

    for (const [period, userIds] of byPeriod) {
      // Deduplicate within the batch (defense in depth; the unique
      // index already prevents duplicate enqueues).
      const deduped = Array.from(new Set(userIds));
      await this.recalculateRanksForUsers(deduped, period as RankingPeriod);
    }

    // Mark all consumed work items as complete. This is the only
    // deletion path; the next batch sees only new work items.
    await this.rankingRepository.completeRecalculationWorkItems(
      workItems.map((wi) => wi.workItemId),
    );

    // For every user that had at least one work item, check whether
    // they still have pending work. If not, clear the per-user latch.
    // We do this with a single grouped query: for each user that had a
    // work item in this batch, count their remaining work items; users
    // with zero remaining get their latch cleared in one statement.
    const usersWithWork = Array.from(new Set(workItems.map((wi) => wi.userId)));
    await this.rankingRepository.clearDirtyFlagsForUsersWithNoPendingWork(usersWithWork);

    this.logger.info({
      event: 'dirty_rankings_processed',
      workItemsProcessed: workItems.length,
      usersAffected: usersWithWork.length,
    });

    return workItems.length;
  }

  /**
   * Perform consistency check on rankings.
   */
  async performConsistencyCheck(): Promise<ConsistencyReport> {
    const issues: RankingIssue[] = [];

    const missingRanks = await this.rankingRepository.findMissingRanks();
    if (missingRanks.length > 0) {
      issues.push({
        type: 'missing_rank',
        description: `${missingRanks.length} users have XP but no rank assigned`,
        severity: 'medium',
      });

      for (const userId of missingRanks) {
        for (const period of [
          RankingPeriod.DAILY,
          RankingPeriod.WEEKLY,
          RankingPeriod.MONTHLY,
          RankingPeriod.ALL_TIME,
        ]) {
          const rank = await this.calculateUserRank(userId, period);
          if (rank !== null) {
            await this.rankingRepository.updateRank({ userId, period, rank });
          }
        }
      }
    }

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

  private async batchUpdateRanks(
    results: RankCalculationResult[],
    period: RankingPeriod,
  ): Promise<void> {
    for (const result of results) {
      const previousRank = await this.rankingRepository.updateRank({
        userId: result.userId,
        period,
        rank: result.rank,
      });

      if (previousRank !== null && previousRank !== result.rank) {
        this.eventBus.emitRankChanged({
          eventType: 'rank.changed',
          userId: result.userId,
          period,
          previousRank,
          newRank: result.rank,
          previousXp: 0,
          newXp: result.xp,
          timestamp: new Date(),
        });
      }

      const peakResult = await this.rankingRepository.updatePeakRank({
        userId: result.userId,
        period,
        rank: result.rank,
      });

      if (peakResult.updated) {
        this.eventBus.emitPeakRankAchieved({
          eventType: 'peak.rank.achieved',
          userId: result.userId,
          period,
          previousPeakRank: peakResult.previousPeakRank,
          newPeakRank: result.rank,
          timestamp: new Date(),
        });
      }

      await this.checkAndPersistMilestones(result.userId, period, result.rank, result.denseRank);
    }

    this.logger.debug({
      event: 'batch_ranks_updated',
      period,
      count: results.length,
    });
  }

  private async batchUpdateRanksForUsers(
    ranked: { userId: string; xp: number; rank: number; denseRank: number }[],
    period: RankingPeriod,
  ): Promise<void> {
    for (const row of ranked) {
      const previousRank = await this.rankingRepository.updateRank({
        userId: row.userId,
        period,
        rank: row.rank,
      });

      if (previousRank !== null && previousRank !== row.rank) {
        this.eventBus.emitRankChanged({
          eventType: 'rank.changed',
          userId: row.userId,
          period,
          previousRank,
          newRank: row.rank,
          previousXp: 0,
          newXp: row.xp,
          timestamp: new Date(),
        });
      }

      const peakResult = await this.rankingRepository.updatePeakRank({
        userId: row.userId,
        period,
        rank: row.rank,
      });

      if (peakResult.updated) {
        this.eventBus.emitPeakRankAchieved({
          eventType: 'peak.rank.achieved',
          userId: row.userId,
          period,
          previousPeakRank: peakResult.previousPeakRank,
          newPeakRank: row.rank,
          timestamp: new Date(),
        });
      }

      await this.checkAndPersistMilestones(row.userId, period, row.rank, row.denseRank);
    }
  }

  private async checkAndPersistMilestones(
    userId: string,
    period: RankingPeriod,
    rank: number,
    denseRank: number,
  ): Promise<void> {
    const milestones = this.getMilestonesForRank(rank);

    if (milestones.length === 0) return;

    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(denseRank, totalParticipants);

    for (const milestone of milestones) {
      const milestoneExists = await this.rankingRepository.hasMilestone({ userId, milestone });
      if (milestoneExists) continue;

      await this.rankingRepository.createMilestone({
        userId,
        milestone,
        rank,
        achievedAt: new Date(),
      });

      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId,
        period,
        milestoneType: milestone,
        rank,
        percentile,
        timestamp: new Date(),
      });
    }
  }

  private getMilestonesForRank(rank: number): RankingMilestone[] {
    const thresholds: Array<{ milestone: RankingMilestone; rank: number }> = [
      { milestone: RankingMilestone.TOP_1, rank: 1 },
      { milestone: RankingMilestone.TOP_3, rank: 3 },
      { milestone: RankingMilestone.TOP_10, rank: 10 },
      { milestone: RankingMilestone.TOP_50, rank: 50 },
      { milestone: RankingMilestone.TOP_100, rank: 100 },
      { milestone: RankingMilestone.TOP_1000, rank: 1000 },
      { milestone: RankingMilestone.TOP_10000, rank: 10000 },
    ];

    return thresholds
      .filter((threshold) => rank <= threshold.rank)
      .map((threshold) => threshold.milestone);
  }
}
