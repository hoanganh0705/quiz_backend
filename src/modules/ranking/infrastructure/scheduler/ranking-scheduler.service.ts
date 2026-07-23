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

/**
 * Phase 3 — Ranking Scheduler
 *
 * Moves scheduling logic from `RankingApplicationService` to the
 * infrastructure layer following the project conventions established
 * by `TournamentSchedulerService`.
 *
 * Why the infrastructure layer?
 * ---------------------------
 * 1. Application services orchestrate use cases. Scheduling is an
 *    infrastructure concern — when to run a job, not what the job does.
 * 2. Having scheduler code in the application layer couples the
 *    application logic to the NestJS lifecycle (`OnModuleInit`), making
 *    testing harder and the application service harder to reuse.
 * 3. Moving scheduler logic to infrastructure/scheduler/ makes the
 *    boundaries cleaner and follows the existing pattern in the codebase.
 *
 * Distributed Lock Strategy
 * ------------------------
 * Uses Redis advisory locks via `CacheProvider.acquireAdvisoryLock()` to
 * ensure only one replica processes each scheduled job at a time. This
 * prevents redundant work when multiple instances of the API are deployed.
 *
 * Lock TTLs are conservative (2–3× expected job duration) to ensure
 * locks auto-release if a replica crashes mid-job.
 *
 * Lock Keys
 * ---------
 *   ranking:cron:dirty-rankings  — Incremental rank recalculation (every 30s)
 *   ranking:cron:period-reset    — Weekly/monthly reset check (every 30s)
 *   ranking:cron:snapshot         — Historical rank snapshots (hourly)
 *   ranking:cron:consistency      — Consistency check (hourly)
 */

/** Lock TTL constants — conservative upper bounds on job duration. */
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
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.DIRTY_RANKINGS);

    if (!acquired) {
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
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.PERIOD_RESET);

    if (!acquired) {
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
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.SNAPSHOT);

    if (!acquired) {
      this.logger.debug({
        event: 'ranking_scheduler_skipped_lock_held',
        job: 'handleRankSnapshots',
      });
      return;
    }

    try {
      const snapshotTime = new Date();

      await this.capturePeriodSnapshot(RankingPeriod.ALL_TIME, snapshotTime);
      await this.capturePeriodSnapshot(RankingPeriod.WEEKLY, snapshotTime);
      await this.capturePeriodSnapshot(RankingPeriod.MONTHLY, snapshotTime);
      await this.capturePeriodSnapshot(RankingPeriod.DAILY, snapshotTime);

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
   * Runs hourly. Protected by Redis advisory lock.
   *
   * Detects and fixes:
   * - Users with XP but no rank assigned
   * - XP mismatches between computed and stored values
   */
  @Cron('30 * * * *')
  async handleConsistencyCheck(): Promise<void> {
    const lockKey = 'ranking:cron:consistency';
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS.CONSISTENCY);

    if (!acquired) {
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
   */
  private async capturePeriodSnapshot(period: RankingPeriod, snapshotTime: Date): Promise<void> {
    const leaderboard = await this.rankingRepository.getLeaderboard({
      period,
      limit: 1000,
      offset: 0,
    });

    const snapshotDate = this.getSnapshotDate(period, snapshotTime);

    await Promise.all(
      leaderboard.map((entry) =>
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
