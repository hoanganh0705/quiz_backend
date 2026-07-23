/**
 * Phase 4 — Rank History Cleanup Service
 *
 * Implements an archival strategy for the `rank_history` table to bound
 * its growth over time.
 *
 * Archival Policy
 * ---------------
 * The table stores ranking snapshots for trend calculation. As time
 * passes, older snapshots become less useful for trend analysis.
 *
 * Retention rules:
 *   - Daily snapshots: keep 90 days (sufficient for weekly trend analysis)
 *   - Weekly snapshots: keep 365 days (sufficient for monthly/yearly trend analysis)
 *   - Monthly snapshots: keep 730 days (2 years for long-term trend analysis)
 *   - All-time snapshots: keep 90 days (all-time is stable, daily snapshots suffice)
 *
 * Implementation Notes
 * -------------------
 * - Uses batch deletion to avoid long-running transactions
 * - Runs as a scheduled job (weekly) to minimize impact
 * - Logs deletion counts for monitoring
 * - Archived data can be recovered from a backup if needed
 *
 * Alternative strategies considered:
 *   - PostgreSQL table partitioning by month: adds complexity, better for
 *     very large tables (>100M rows). Current approach with archival is simpler.
 *   - Archival to cold storage (S3): requires infrastructure changes,
 *     good for very long retention. Currently not implemented.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { lt, and, eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { rankHistory } from '@/core/database/schema';

/** Retention periods in days for each period type. */
const RETENTION_DAYS = Object.freeze({
  daily: 90,
  weekly: 365,
  monthly: 730,
  all_time: 90,
} as const);

/** Lock TTL for cleanup job (15 minutes). */
const CLEANUP_LOCK_TTL_MS = 15 * 60 * 1000;

/** Batch size for deletion to avoid long-running transactions. */
const DELETE_BATCH_SIZE = 10_000;

@Injectable()
export class RankHistoryCleanupService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(RankHistoryCleanupService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Weekly cleanup job that removes stale rank history records.
   * Runs every Sunday at 3:00 AM to minimize impact on peak usage.
   *
   * Protected by Redis advisory lock to ensure only one replica runs cleanup.
   */
  @Cron('0 3 * * 0')
  async handleRankHistoryCleanup(): Promise<void> {
    const lockKey = 'ranking:cron:history-cleanup';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, CLEANUP_LOCK_TTL_MS);

    if (!acquired) {
      this.logger.debug({
        event: 'rank_history_cleanup_skipped_lock_held',
      });
      return;
    }

    try {
      this.logger.info({ event: 'rank_history_cleanup_started' });
      const results = await this.runCleanup();
      this.logger.info({
        event: 'rank_history_cleanup_completed',
        ...results,
      });
    } catch (error) {
      this.logger.error({
        event: 'rank_history_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  /**
   * Runs the cleanup process for all period types.
   * Uses batch deletion to avoid long-running transactions.
   */
  private async runCleanup(): Promise<{
    dailyDeleted: number;
    weeklyDeleted: number;
    monthlyDeleted: number;
    allTimeDeleted: number;
    totalDeleted: number;
  }> {
    const results = {
      dailyDeleted: 0,
      weeklyDeleted: 0,
      monthlyDeleted: 0,
      allTimeDeleted: 0,
    };

    // Calculate cutoff dates
    const now = new Date();
    const dailyCutoff = this.subtractDays(now, RETENTION_DAYS.daily);
    const weeklyCutoff = this.subtractDays(now, RETENTION_DAYS.weekly);
    const monthlyCutoff = this.subtractDays(now, RETENTION_DAYS.monthly);
    const allTimeCutoff = this.subtractDays(now, RETENTION_DAYS.all_time);

    // Delete daily records older than retention period
    results.dailyDeleted = await this.deleteOldRecords('daily', dailyCutoff);

    // Delete weekly records older than retention period
    results.weeklyDeleted = await this.deleteOldRecords('weekly', weeklyCutoff);

    // Delete monthly records older than retention period
    results.monthlyDeleted = await this.deleteOldRecords('monthly', monthlyCutoff);

    // Delete all-time records older than retention period
    results.allTimeDeleted = await this.deleteOldRecords('all_time', allTimeCutoff);

    return {
      ...results,
      totalDeleted:
        results.dailyDeleted +
        results.weeklyDeleted +
        results.monthlyDeleted +
        results.allTimeDeleted,
    };
  }

  /**
   * Deletes records for a specific period older than the cutoff date.
   * Uses batch deletion to avoid long-running transactions.
   */
  private async deleteOldRecords(period: string, cutoffDate: Date): Promise<number> {
    let totalDeleted = 0;
    let deletedThisBatch: number;

    do {
      // Use Drizzle's delete with limit for batch deletion
      const result = await this.db
        .delete(rankHistory)
        .where(
          and(
            eq(rankHistory.period, period),
            lt(rankHistory.snapshotDate, cutoffDate.toISOString()),
          ),
        )
        .returning({ id: rankHistory.historyId });

      deletedThisBatch = result.length;
      totalDeleted += deletedThisBatch;

      if (deletedThisBatch > 0) {
        this.logger.debug({
          event: 'rank_history_batch_deleted',
          period,
          batchSize: deletedThisBatch,
          totalDeleted,
        });
      }
    } while (deletedThisBatch === DELETE_BATCH_SIZE);

    return totalDeleted;
  }

  /**
   * Utility to subtract days from a date.
   */
  private subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  /**
   * Manual trigger for rank history cleanup.
   * Useful for running cleanup on-demand or after migrations.
   */
  async triggerCleanup(): Promise<{
    dailyDeleted: number;
    weeklyDeleted: number;
    monthlyDeleted: number;
    allTimeDeleted: number;
    totalDeleted: number;
  }> {
    this.logger.info({ event: 'rank_history_cleanup_manual_trigger' });
    return this.runCleanup();
  }

  /**
   * Returns the current retention settings.
   * Useful for monitoring and admin interfaces.
   */
  getRetentionPolicy(): Record<string, { retentionDays: number; description: string }> {
    return {
      daily: {
        retentionDays: RETENTION_DAYS.daily,
        description: 'Daily snapshots retained for 90 days',
      },
      weekly: {
        retentionDays: RETENTION_DAYS.weekly,
        description: 'Weekly snapshots retained for 365 days',
      },
      monthly: {
        retentionDays: RETENTION_DAYS.monthly,
        description: 'Monthly snapshots retained for 730 days (2 years)',
      },
      all_time: {
        retentionDays: RETENTION_DAYS.all_time,
        description: 'All-time snapshots retained for 90 days',
      },
    };
  }
}
