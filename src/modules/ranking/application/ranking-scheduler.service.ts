/**
 * Ranking Scheduler Service
 *
 * Implements the hybrid refresh strategy:
 * - Event-driven: Immediate XP updates, batch rank recalculation
 * - Scheduled: Hourly consistency checks, periodic full recalculations
 *
 * Part of Phase 2 - Core Features.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RankCalculationService } from './rank-calculation.service';
import { PeriodResetService } from './period-reset.service';
import { PeakRankService } from './peak-rank.service';
import type { RankingDomainEventBusPort } from '../domain/ports/ranking-event-bus.port';
import { RankingPeriod } from '../domain/types/ranking.types';

@Injectable()
export class RankingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private consistencyInterval: NodeJS.Timeout | null = null;
  private readonly SCHEDULER_INTERVAL_MS = 30_000; // 30 seconds
  private readonly CONSISTENCY_INTERVAL_MS = 3_600_000; // 1 hour

  constructor(
    private readonly rankCalculationService: RankCalculationService,
    private readonly periodResetService: PeriodResetService,
    private readonly peakRankService: PeakRankService,
    @Inject('RANKING_DOMAIN_EVENT_BUS')
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(RankingSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'ranking_scheduler_started',
    });

    // Start the scheduler
    this.startScheduler();

    // Start the consistency checker
    this.startConsistencyChecker();

    // Subscribe to rank changed events
    this.eventBus.subscribe(this.handleRankChanged.bind(this));
  }

  onModuleDestroy(): void {
    this.stopScheduler();
    this.stopConsistencyChecker();
    this.logger.info({
      event: 'ranking_scheduler_stopped',
    });
  }

  /**
   * Start the main scheduler loop.
   * Processes dirty rankings every 30 seconds.
   */
  private startScheduler(): void {
    if (this.schedulerInterval) return;

    this.schedulerInterval = setInterval(async () => {
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
    }, this.SCHEDULER_INTERVAL_MS);
  }

  /**
   * Stop the scheduler.
   */
  private stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Start the consistency checker.
   * Runs every hour to verify ranking consistency.
   */
  private startConsistencyChecker(): void {
    if (this.consistencyInterval) return;

    this.consistencyInterval = setInterval(async () => {
      try {
        await this.runConsistencyCheck();
      } catch (error) {
        this.logger.error({
          event: 'consistency_check_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, this.CONSISTENCY_INTERVAL_MS);
  }

  /**
   * Stop the consistency checker.
   */
  private stopConsistencyChecker(): void {
    if (this.consistencyInterval) {
      clearInterval(this.consistencyInterval);
      this.consistencyInterval = null;
    }
  }

  /**
   * Run a single scheduler cycle.
   * Processes dirty rankings for all periods.
   */
  private async runSchedulerCycle(): Promise<void> {
    const startTime = Date.now();

    // Check for period resets
    if (this.periodResetService.isResetDue(RankingPeriod.WEEKLY)) {
      await this.periodResetService.performWeeklyReset();
    }

    if (this.periodResetService.isResetDue(RankingPeriod.MONTHLY)) {
      await this.periodResetService.performMonthlyReset();
    }

    // Process dirty rankings
    const processed = await this.rankCalculationService.processDirtyRankings();

    if (processed > 0) {
      this.logger.debug({
        event: 'scheduler_cycle_completed',
        processed,
        durationMs: Date.now() - startTime,
      });
    }
  }

  /**
   * Run a consistency check on all rankings.
   */
  private async runConsistencyCheck(): Promise<void> {
    const startTime = Date.now();

    // Run consistency check
    const report = await this.rankCalculationService.performConsistencyCheck();

    // Emit consistency check event
    this.eventBus.emitConsistencyCheck({
      eventType: 'consistency.check',
      issuesFound: report.totalIssues,
      issuesFixed: report.fixed,
      timestamp: new Date(),
    });

    // If there were issues, log them
    if (report.totalIssues > 0) {
      this.logger.warn({
        event: 'consistency_issues_found',
        totalIssues: report.totalIssues,
        fixed: report.fixed,
        durationMs: Date.now() - startTime,
      });
    }
  }

  /**
   * Handle rank changed events.
   * Updates peak ranks when ranks change.
   */
  private async handleRankChanged(event: {
    userId: string;
    period: RankingPeriod;
    newRank: number;
  }): Promise<void> {
    try {
      await this.peakRankService.checkAndUpdatePeakRank(
        event.userId,
        event.period,
        event.newRank,
      );
    } catch (error) {
      this.logger.error({
        event: 'peak_rank_update_error',
        userId: event.userId,
        period: event.period,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
   * Get scheduler status.
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
