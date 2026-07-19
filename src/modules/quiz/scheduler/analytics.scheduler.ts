import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class AnalyticsSchedulerService {
  constructor(
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(AnalyticsSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Refresh trending scores every 5 minutes
   * Keeps trending scores current
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleTrendingRefresh(): Promise<void> {
    this.logger.info({ event: 'cron_trending_refresh_start' });
    try {
      await this.quizAnalyticsService.refreshAllTrendingScores();
      this.logger.info({ event: 'cron_trending_refresh_complete' });
    } catch (error) {
      this.logger.error({
        event: 'cron_trending_refresh_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Refresh popularity scores every hour
   * Re-normalize popularity scores
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handlePopularityRefresh(): Promise<void> {
    this.logger.info({ event: 'cron_popularity_refresh_start' });
    try {
      await this.quizAnalyticsService.refreshAllPopularityScores();
      this.logger.info({ event: 'cron_popularity_refresh_complete' });
    } catch (error) {
      this.logger.error({
        event: 'cron_popularity_refresh_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Full metrics rebuild every Sunday at 3 AM
   * Complete metric recalculation
   */
  @Cron('0 3 * * 0')
  async handleFullRebuild(): Promise<void> {
    this.logger.info({ event: 'cron_full_rebuild_start' });
    try {
      await this.quizAnalyticsService.rebuildAllMetrics();
      this.logger.info({ event: 'cron_full_rebuild_complete' });
    } catch (error) {
      this.logger.error({
        event: 'cron_full_rebuild_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Daily validation check at 2 AM
   * Detect and fix inconsistencies
   */
  @Cron('0 2 * * *')
  async handleDailyValidation(): Promise<void> {
    this.logger.info({ event: 'cron_daily_validation_start' });
    try {
      await this.quizAnalyticsService.validateMetrics();
      this.logger.info({ event: 'cron_daily_validation_complete' });
    } catch (error) {
      this.logger.error({
        event: 'cron_daily_validation_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Daily reconciliation of quiz attempt/avg-score counters at 5 AM.
   *
   * Fix #7 — `denormalized-counters-audit.md` §Fix #7. Recomputes
   * `quiz_stats.total_attempts` and `avg_score_percent` for every active quiz
   * by calling `refreshQuizMetrics`, healing any drift between the inline
   * `total_attempts + 1` running counter in
   * `AttemptRepository.completeAttemptAndSideEffects` and the source-of-truth
   * `COUNT(quiz_attempts)`. Runs every day, not just weekly, so a single
   * bad attempt completion (e.g. process crash mid-transaction, manual DB
   * fix, future schema change) is repaired within 24 hours.
   */
  @Cron('0 5 * * *')
  async handleQuizMetricsReconcile(): Promise<void> {
    this.logger.info({ event: 'cron_quiz_metrics_reconcile_start' });
    try {
      const summary = await this.quizAnalyticsService.reconcileAllQuizMetrics();
      this.logger.info({
        event: 'cron_quiz_metrics_reconcile_complete',
        ...summary,
      });
    } catch (error) {
      this.logger.error({
        event: 'cron_quiz_metrics_reconcile_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
