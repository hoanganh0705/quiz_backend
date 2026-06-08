/**
 * Ranking Application Service
 *
 * Implements the hybrid refresh strategy:
 * - Event-driven: Immediate XP updates, batch rank recalculation
 * - Scheduled: Hourly consistency checks, periodic full recalculations
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../domain/ports/ranking-event-bus.port';
import { RankingPeriod } from '../domain/types/ranking.types';
import { PeriodResetService, RankCalculationService } from '../domain/services';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';

@Injectable()
export class RankingApplicationService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private consistencyInterval: NodeJS.Timeout | null = null;
  private snapshotInterval: NodeJS.Timeout | null = null;
  private readonly SCHEDULER_INTERVAL_MS = 30_000; // 30 seconds
  private readonly CONSISTENCY_INTERVAL_MS = 3_600_000; // 1 hour
  private readonly SNAPSHOT_INTERVAL_MS = 3_600_000; // 1 hour

  constructor(
    private readonly rankCalculationService: RankCalculationService,
    private readonly periodResetService: PeriodResetService,
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(RankingApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'ranking_application_service_started',
    });

    this.startScheduler();
    this.startConsistencyChecker();
    this.startSnapshotScheduler();
  }

  onModuleDestroy(): void {
    this.stopScheduler();
    this.stopConsistencyChecker();
    this.stopSnapshotScheduler();
    this.logger.info({
      event: 'ranking_application_service_stopped',
    });
  }

  private startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(() => {
      void (async () => {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
          await this.runSchedulerCycle();
        } catch (error) {
          this.logger.error({
            event: 'scheduler_cycle_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          this.isRunning = false;
        }
      })();
    }, this.SCHEDULER_INTERVAL_MS);
  }

  private stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  private startConsistencyChecker(): void {
    if (this.consistencyInterval) return;

    this.consistencyInterval = setInterval(() => {
      void (async () => {
        try {
          await this.runConsistencyCheck();
        } catch (error) {
          this.logger.error({
            event: 'consistency_check_error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })();
    }, this.CONSISTENCY_INTERVAL_MS);
  }

  private stopConsistencyChecker(): void {
    if (this.consistencyInterval) {
      clearInterval(this.consistencyInterval);
      this.consistencyInterval = null;
    }
  }

  private startSnapshotScheduler(): void {
    if (this.snapshotInterval) return;

    this.snapshotInterval = setInterval(() => {
      void this.captureHistoricalSnapshots().catch((error: unknown) => {
        this.logger.error({
          event: 'ranking_snapshot_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, this.SNAPSHOT_INTERVAL_MS);
  }

  private stopSnapshotScheduler(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  private async runSchedulerCycle(): Promise<void> {
    const startTime = Date.now();

    if (this.periodResetService.isResetDue(RankingPeriod.WEEKLY)) {
      await this.periodResetService.performWeeklyReset();
    }

    if (this.periodResetService.isResetDue(RankingPeriod.MONTHLY)) {
      await this.periodResetService.performMonthlyReset();
    }

    const processed = await this.rankCalculationService.processDirtyRankings();

    if (processed > 0) {
      this.logger.debug({
        event: 'scheduler_cycle_completed',
        processed,
        durationMs: Date.now() - startTime,
      });
    }
  }

  private async runConsistencyCheck(): Promise<void> {
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
        event: 'consistency_issues_found',
        totalIssues: report.totalIssues,
        fixed: report.fixed,
        durationMs: Date.now() - startTime,
      });
    }
  }

  private async captureHistoricalSnapshots(): Promise<void> {
    const snapshotTime = new Date();

    await this.capturePeriodSnapshot(RankingPeriod.ALL_TIME, snapshotTime);
    await this.capturePeriodSnapshot(RankingPeriod.WEEKLY, snapshotTime);
    await this.capturePeriodSnapshot(RankingPeriod.MONTHLY, snapshotTime);
    await this.capturePeriodSnapshot(RankingPeriod.DAILY, snapshotTime);
  }

  private async capturePeriodSnapshot(period: RankingPeriod, snapshotTime: Date): Promise<void> {
    if (period === RankingPeriod.DAILY) {
      const leaderboard = await this.rankingRepository.getLeaderboard({
        period: RankingPeriod.ALL_TIME,
        limit: 1000,
        offset: 0,
      });

      await Promise.all(
        leaderboard.map((entry) =>
          this.rankingRepository.createRankHistory({
            userId: entry.userId,
            period: RankingPeriod.DAILY,
            snapshotDate: this.getStartOfDay(snapshotTime),
            rank: entry.rank,
            xp: entry.xp,
            recordedAt: snapshotTime,
          }),
        ),
      );

      return;
    }

    const leaderboard = await this.rankingRepository.getLeaderboard({
      period,
      limit: 1000,
      offset: 0,
    });

    await Promise.all(
      leaderboard.map((entry) =>
        this.rankingRepository.createRankHistory({
          userId: entry.userId,
          period,
          snapshotDate: this.getSnapshotDate(period, snapshotTime),
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

  /**
   * Trigger an immediate rank recalculation.
   * Use sparingly - prefer the scheduled process.
   */
  async triggerImmediateRecalculation(period?: RankingPeriod): Promise<void> {
    this.logger.info({
      event: 'immediate_recalculation_triggered',
      period: period ?? 'all',
    });

    if (period) {
      await this.rankCalculationService.calculateAllRanks(period);
    } else {
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.ALL_TIME);
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.WEEKLY);
      await this.rankCalculationService.calculateAllRanks(RankingPeriod.MONTHLY);
    }
  }

  /**
   * Get service status.
   */
  getStatus(): {
    isRunning: boolean;
    schedulerActive: boolean;
    consistencyCheckerActive: boolean;
  } {
    return {
      isRunning: this.isRunning,
      schedulerActive: this.schedulerInterval !== null,
      consistencyCheckerActive: this.consistencyInterval !== null,
    };
  }
}
