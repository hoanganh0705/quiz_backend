import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';

const ANALYTICS_LOCK_TTL_MS = 10 * 60 * 1000;

const ANALYTICS_LOCK_KEYS = Object.freeze({
  TRENDING: 'analytics:cron:trending_refresh',
  POPULARITY: 'analytics:cron:popularity_refresh',
  FULL_REBUILD: 'analytics:cron:full_rebuild',
  DAILY_VALIDATION: 'analytics:cron:metrics_validation',
  QUIZ_METRICS_RECONCILE: 'analytics:cron:metrics_reconciliation',
  REVIEW_METRICS_RECONCILE: 'analytics:cron:review_metrics_reconciliation',
});

@Injectable()
export class AnalyticsSchedulerService {
  constructor(
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(AnalyticsSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  private async runIfLockAcquired(args: {
    lockKey: string;
    job: string;
    body: () => Promise<void>;
  }): Promise<void> {
    const lockToken = await this.acquireLockOrSkip(args.lockKey, args.job);
    if (lockToken === null) return;
    try {
      await args.body();
    } finally {
      await this.cache.releaseAdvisoryLock(args.lockKey, lockToken);
    }
  }

  private async acquireLockOrSkip(lockKey: string, job: string): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey,
      lockTtlMs: ANALYTICS_LOCK_TTL_MS,
      job,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'analytics_scheduler_skipped_lock_held',
      job,
      lockKey,
      reason: result.reason,
    });
    return null;
  }

  /**
   * Refresh trending scores every 5 minutes
   * Keeps trending scores current
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleTrendingRefresh(): Promise<void> {
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.TRENDING,
      job: 'analytics-trending-refresh',
      body: async () => {
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
      },
    });
  }

  /**
   * Refresh popularity scores every hour
   * Re-normalize popularity scores
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handlePopularityRefresh(): Promise<void> {
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.POPULARITY,
      job: 'analytics-popularity-refresh',
      body: async () => {
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
      },
    });
  }

  /**
   * Full metrics rebuild every Sunday at 3 AM
   * Complete metric recalculation
   */
  @Cron('0 3 * * 0')
  async handleFullRebuild(): Promise<void> {
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.FULL_REBUILD,
      job: 'analytics-full-rebuild',
      body: async () => {
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
      },
    });
  }

  /**
   * Daily validation check at 2 AM
   * Detect and fix inconsistencies
   */
  @Cron('0 2 * * *')
  async handleDailyValidation(): Promise<void> {
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.DAILY_VALIDATION,
      job: 'analytics-daily-validation',
      body: async () => {
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
      },
    });
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
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.QUIZ_METRICS_RECONCILE,
      job: 'analytics-quiz-metrics-reconcile',
      body: async () => {
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
      },
    });
  }

  @Cron('30 5 * * *')
  async handleReviewMetricsReconcile(): Promise<void> {
    return this.runIfLockAcquired({
      lockKey: ANALYTICS_LOCK_KEYS.REVIEW_METRICS_RECONCILE,
      job: 'analytics-review-metrics-reconcile',
      body: async () => {
        this.logger.info({ event: 'cron_review_metrics_reconcile_start' });
        try {
          const summary = await this.quizAnalyticsService.reconcileAllReviewMetrics();
          this.logger.info({
            event: 'cron_review_metrics_reconcile_complete',
            ...summary,
          });
        } catch (error) {
          this.logger.error({
            event: 'cron_review_metrics_reconcile_failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });
  }
}
