import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { RankCalculationService } from '../../domain/services/rank-calculation.service';
import { PeriodResetService } from '../../domain/services/period-reset.service';
import { RankingPeriod } from '../../domain/types/ranking.types';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../../domain/ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../../domain/ports/ranking-event-bus.port';

const LOCK_TTL_MS = Object.freeze({
  /** 1-minute TTL — dirty rankings processing should complete in seconds */
  DIRTY_RANKINGS: 1 * 60 * 1000,
  /** 1-minute TTL — period reset check is fast */
  PERIOD_RESET: 1 * 60 * 1000,
  /** 5-minute TTL — snapshot capture for up to 4 periods */
  SNAPSHOT: 5 * 60 * 1000,
  /** 5-minute TTL — consistency check processes all users */
  CONSISTENCY: 5 * 60 * 1000,
});

@Injectable()
export class RankingSchedulerService {
  constructor(
    private readonly rankCalculationService: RankCalculationService,
    private readonly periodResetService: PeriodResetService,
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(RankingSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Processes pending rank recalculation work items.
   *
   * Runs every 30 seconds. Protected by Redis advisory lock so only
   * one replica processes the dirty queue at a time.
   *
   * The work is idempotent: `processDirtyRankings` deletes work items
   * by ID after processing, so duplicate processing is prevented.
   */
  @Cron('*/30 * * * * *')
  async handleDirtyRankings(): Promise<void> {
    const lockKey = 'ranking:cron:dirty-rankings';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.DIRTY_RANKINGS);

    if (lockToken === null) {
      this.logger.debug({
        event: 'ranking_scheduler_skipped_lock_held',
        job: 'handleDirtyRankings',
      });
      return;
    }

    try {
      const startTime = Date.now();
      const processed = await this.rankCalculationService.processDirtyRankings();

      if (processed > 0) {
        this.logger.info({
          event: 'ranking_scheduler_dirty_rankings_completed',
          processed,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'ranking_scheduler_dirty_rankings_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  /**
   * Checks for due period resets (weekly, monthly).
   *
   * Runs every 30 seconds. Protected by Redis advisory lock.
   *
   * Period resets are time-sensitive — if we miss a reset window,
   * rankings could be stale for up to 30 seconds, which is acceptable
   * for weekly/monthly periods.
   */
  @Cron('*/30 * * * * *')
  async handlePeriodResets(): Promise<void> {
    const lockKey = 'ranking:cron:period-reset';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.PERIOD_RESET);

    if (lockToken === null) {
      this.logger.debug({
        event: 'ranking_scheduler_skipped_lock_held',
        job: 'handlePeriodResets',
      });
      return;
    }

    try {
      const startTime = Date.now();

      if (this.periodResetService.isResetDue(RankingPeriod.WEEKLY)) {
        this.logger.info({ event: 'ranking_scheduler_weekly_reset_start' });
        await this.periodResetService.performWeeklyReset();
        this.logger.info({ event: 'ranking_scheduler_weekly_reset_complete' });
      }

      if (this.periodResetService.isResetDue(RankingPeriod.MONTHLY)) {
        this.logger.info({ event: 'ranking_scheduler_monthly_reset_start' });
        await this.periodResetService.performMonthlyReset();
        this.logger.info({ event: 'ranking_scheduler_monthly_reset_complete' });
      }

      this.logger.debug({
        event: 'ranking_scheduler_period_reset_completed',
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error({
        event: 'ranking_scheduler_period_reset_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  /**
   * Captures historical rank snapshots for trend analysis.
   *
   * Runs hourly. Protected by Redis advisory lock.
   *
   * Snapshots are used for trend calculation (see `determineTrend()`).
   * Daily snapshots are captured as the start-of-day all-time leaderboard,
   * while weekly/monthly snapshots capture period-specific ranks.
   */
  @Cron('0 * * * *')
  async handleRankSnapshots(): Promise<void> {
    const lockKey = 'ranking:cron:snapshot';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.SNAPSHOT);

    if (lockToken === null) {
      this.logger.debug({
        event: 'ranking_scheduler_skipped_lock_held',
        job: 'handleRankSnapshots',
      });
      return;
    }

    try {
      const snapshotTime = new Date();

      await Promise.all([
        this.capturePeriodSnapshot(RankingPeriod.ALL_TIME, snapshotTime),
        this.capturePeriodSnapshot(RankingPeriod.WEEKLY, snapshotTime),
        this.capturePeriodSnapshot(RankingPeriod.MONTHLY, snapshotTime),
        this.capturePeriodSnapshot(RankingPeriod.DAILY, snapshotTime),
      ]);

      this.logger.info({
        event: 'ranking_scheduler_snapshots_completed',
        snapshotTime: snapshotTime.toISOString(),
      });
    } catch (error) {
      this.logger.error({
        event: 'ranking_scheduler_snapshots_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  /**
   * Performs consistency checks on ranking data.
   *
   * Runs daily at 04:00. Protected by Redis advisory lock so only one
   * replica executes the sweep.
   *
   * Detects and fixes:
   * - Users with XP but no rank assigned
   * - XP mismatches between computed and stored values
   */
  @Cron('0 4 * * *')
  async handleConsistencyCheck(): Promise<void> {
    const lockKey = 'ranking:cron:consistency';
    const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.CONSISTENCY);

    if (lockToken === null) {
      this.logger.debug({
        event: 'ranking_scheduler_skipped_lock_held',
        job: 'handleConsistencyCheck',
      });
      return;
    }

    try {
      const startTime = Date.now();
      const report = await this.rankCalculationService.performConsistencyCheck();

      this.eventBus.emitConsistencyCheck({
        eventType: 'consistency.check',
        issuesFound: report.totalIssues,
        issuesFixed: report.fixed,
        timestamp: new Date(),
      });

      if (report.totalIssues > 0) {
        this.logger.warn({
          event: 'ranking_scheduler_consistency_issues_found',
          totalIssues: report.totalIssues,
          fixed: report.fixed,
          durationMs: Date.now() - startTime,
        });
      } else {
        this.logger.info({
          event: 'ranking_scheduler_consistency_check_passed',
          durationMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'ranking_scheduler_consistency_check_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(lockKey, lockToken);
    }
  }

  /**
   * Captures rank history snapshots for a specific period.
   *
   * Paginates the leaderboard in chunks of 1000 up to SNAPSHOT_MAX_ENTRIES
   * (10k) so users beyond the top 1000 still get periodic history rows.
   * Each chunk's createRankHistory calls run in parallel.
   */
  private async capturePeriodSnapshot(period: RankingPeriod, snapshotTime: Date): Promise<void> {
    const snapshotDate = this.getSnapshotDate(period, snapshotTime);
    const pageSize = 1000;
    const maxEntries = 10_000;
    let offset = 0;
    let totalCaptured = 0;

    while (totalCaptured < maxEntries) {
      const remaining = maxEntries - totalCaptured;
      const limit = Math.min(pageSize, remaining);

      const page = await this.rankingRepository.getLeaderboard({
        period,
        limit,
        offset,
      });

      if (page.length === 0) {
        break;
      }

      await Promise.all(
        page.map((entry) =>
          this.rankingRepository.createRankHistory({
            userId: entry.userId,
            period,
            snapshotDate,
            rank: entry.rank,
            xp: entry.xp,
            recordedAt: snapshotTime,
          }),
        ),
      );

      totalCaptured += page.length;
      offset += page.length;

      if (page.length < limit) {
        break;
      }
    }
  }

  private getSnapshotDate(period: RankingPeriod, date: Date): Date {
    switch (period) {
      case RankingPeriod.DAILY:
        return this.getStartOfDay(date);
      case RankingPeriod.WEEKLY:
        return this.getStartOfWeek(date);
      case RankingPeriod.MONTHLY:
        return this.getStartOfMonth(date);
      case RankingPeriod.ALL_TIME:
      default:
        return this.getStartOfDay(date);
    }
  }

  private getStartOfDay(date: Date): Date {
    const snapshot = new Date(date);
    snapshot.setUTCHours(0, 0, 0, 0);
    return snapshot;
  }

  private getStartOfWeek(date: Date): Date {
    const snapshot = this.getStartOfDay(date);
    const day = snapshot.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    snapshot.setUTCDate(snapshot.getUTCDate() + diff);
    return snapshot;
  }

  private getStartOfMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
}
