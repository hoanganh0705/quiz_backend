import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql } from 'drizzle-orm';
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
  getRankFieldName,
} from '../types/ranking.types';
import type {
  RankCalculationResult,
  ConsistencyReport,
  RankingIssue,
} from '../types/ranking.types';
import { RankCalculationError } from '../errors/ranking-domain.errors';
import { RankingCacheVersionService } from './ranking-cache-version.service';

@Injectable()
export class RankCalculationService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cacheVersionService: RankingCacheVersionService,
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
   *
   * Transaction safety: Work item deletion and dirty-flag clearing are
   * wrapped in a single database transaction. If the transaction fails,
   * both operations roll back together, preventing inconsistent state
   * where work items are deleted but latches remain set (or vice versa).
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
      const deduped = Array.from(new Set(userIds));
      await this.recalculateRanksForUsers(deduped, period as RankingPeriod);
    }

    // For every user that had at least one work item, check whether
    // they still have pending work. If not, clear the per-user latch.
    // We do this with a single grouped query: for each user that had a
    // work item in this batch, count their remaining work items; users
    // with zero remaining get their latch cleared in one statement.
    const usersWithWork = Array.from(new Set(workItems.map((wi) => wi.userId)));

    // Atomically delete work items and clear dirty flags within a transaction.
    // This ensures that if the deletion succeeds but latch clearing fails,
    // the transaction rolls back and the next run will retry both operations.
    await this.db.transaction(async (tx) => {
      await this.rankingRepository.completeRecalculationWorkItemsInTx(
        tx,
        workItems.map((wi) => wi.workItemId),
      );
      await this.rankingRepository.clearDirtyFlagsForUsersWithNoPendingWorkInTx(tx, usersWithWork);
    });

    this.logger.info({
      event: 'dirty_rankings_processed',
      workItemsProcessed: workItems.length,
      usersAffected: usersWithWork.length,
    });

    if (workItems.length > 0) {
      await this.cacheVersionService.bumpAllPeriods();
    }

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

      const allPeriods = [
        RankingPeriod.DAILY,
        RankingPeriod.WEEKLY,
        RankingPeriod.MONTHLY,
        RankingPeriod.ALL_TIME,
      ];
      const now = new Date();

      for (const period of allPeriods) {
        const ranked = await this.rankingRepository.calculateAllRanksForUsers({
          userIds: missingRanks,
          period,
        });
        if (ranked.length > 0) {
          const updates = ranked.map((r) => ({ userId: r.userId, period, rank: r.rank }));
          await this.rankingRepository.batchUpdateRanks({ updates, now });
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
    if (results.length === 0) return;

    const now = new Date();

    const rankUpdates = results.map((r) => ({ userId: r.userId, period, rank: r.rank }));

    const previousRanks = new Map<string, number | null>();
    for (const r of results) {
      const existing = await this.rankingRepository.getRankingsForUsers([r.userId]);
      const row = existing[0];
      const field = getRankFieldName(period);
      previousRanks.set(r.userId, (row as any)?.[field] ?? null);
    }

    const peakResults = await this.rankingRepository.batchUpdatePeakRanks({
      updates: rankUpdates,
      now,
    });

    const peakResultsMap = new Map(peakResults.map((p) => [p.userId, p]));

    const milestoneTriples: Array<{
      userId: string;
      milestone: RankingMilestone;
      rank: number;
      achievedAt: Date;
    }> = [];

    for (const result of results) {
      const prevRank = previousRanks.get(result.userId) ?? null;
      if (prevRank !== null && prevRank !== result.rank) {
        this.eventBus.emitRankChanged({
          eventType: 'rank.changed',
          userId: result.userId,
          period,
          previousRank: prevRank,
          newRank: result.rank,
          previousXp: 0,
          newXp: result.xp,
          timestamp: now,
        });
      }

      const peak = peakResultsMap.get(result.userId);
      if (peak && peak.previousPeakRank !== undefined) {
        this.eventBus.emitPeakRankAchieved({
          eventType: 'peak.rank.achieved',
          userId: result.userId,
          period,
          previousPeakRank: peak.previousPeakRank,
          newPeakRank: result.rank,
          isInitialAchievement: peak.previousPeakRank === null,
          timestamp: now,
        });
      }

      const milestones = this.getMilestonesForRank(result.rank);
      for (const milestone of milestones) {
        milestoneTriples.push({
          userId: result.userId,
          milestone,
          rank: result.rank,
          achievedAt: now,
        });
      }
    }

    await this.rankingRepository.batchUpdateRanks({ updates: rankUpdates, now });

    if (milestoneTriples.length > 0) {
      await this.checkAndPersistMilestonesForBatch(milestoneTriples, results, period);
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
    if (ranked.length === 0) return;

    const results: RankCalculationResult[] = ranked.map((r) => ({
      ...r,
      period,
    }));
    await this.batchUpdateRanks(results, period);
  }

  private async processRankUpdate(
    row: { userId: string; xp: number; rank: number; denseRank: number },
    period: RankingPeriod,
  ): Promise<void> {
    const now = new Date();
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
        timestamp: now,
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
        isInitialAchievement: peakResult.previousPeakRank === null,
        timestamp: now,
      });
    }

    await this.checkAndPersistMilestones(row.userId, period, row.rank, row.denseRank);
  }

  private async checkAndPersistMilestonesForBatch(
    milestoneTriples: Array<{
      userId: string;
      milestone: RankingMilestone;
      rank: number;
      achievedAt: Date;
    }>,
    results: RankCalculationResult[],
    period: RankingPeriod,
  ): Promise<void> {
    if (milestoneTriples.length === 0) return;

    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);

    const existingResult = await this.db.execute(sql`
      SELECT user_id, milestone
      FROM ranking_milestones
      WHERE (user_id, milestone) IN (
        VALUES ${sql.join(
          milestoneTriples.map((t) => sql`(${t.userId}::uuid, ${t.milestone})`),
          sql`, `,
        )}
      )
    `);

    const existingSet = new Set(
      ((existingResult as any).rows ?? []).map(
        (r: { user_id: string; milestone: string }) => `${r.user_id}::${r.milestone}`,
      ),
    );

    const absentTriples = milestoneTriples.filter(
      (t) => !existingSet.has(`${t.userId}::${t.milestone}`),
    );

    if (absentTriples.length > 0) {
      await this.rankingRepository.persistMilestones({ triples: absentTriples });
    }

    const resultsMap = new Map(results.map((r) => [r.userId, r]));
    const newlyPersistedSet = new Set(absentTriples.map((t) => `${t.userId}::${t.milestone}`));

    for (const triple of milestoneTriples) {
      if (!newlyPersistedSet.has(`${triple.userId}::${triple.milestone}`)) continue;
      const result = resultsMap.get(triple.userId);
      const denseRank = result?.denseRank ?? triple.rank;
      const percentile = calculatePercentile(denseRank, totalParticipants);
      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId: triple.userId,
        period,
        milestoneType: triple.milestone,
        rank: triple.rank,
        percentile,
        timestamp: triple.achievedAt,
      });
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
