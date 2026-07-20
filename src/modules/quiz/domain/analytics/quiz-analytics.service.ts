import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TrendingService } from './trending.service';
import { PopularityService } from './popularity.service';
import {
  QUIZ_ANALYTICS_REPOSITORY_PORT,
  METRICS_REPOSITORY_PORT,
  type QuizAnalyticsPort,
  type QuizAnalyticsRepositoryPort,
  type MetricsRepositoryPort,
} from './ports';
import { QuizNotFoundError } from './errors';
import type {
  QuizAnalytics,
  TrendingQuiz,
  PopularQuiz,
  CategoryAnalytics,
  CreatorAnalytics,
  TagAnalytics,
} from './types';

@Injectable()
export class QuizAnalyticsService implements QuizAnalyticsPort {
  constructor(
    @Inject(QUIZ_ANALYTICS_REPOSITORY_PORT)
    private readonly analyticsRepository: QuizAnalyticsRepositoryPort,
    @Inject(METRICS_REPOSITORY_PORT)
    private readonly metricsRepository: MetricsRepositoryPort,
    private readonly trendingService: TrendingService,
    private readonly popularityService: PopularityService,
    @InjectPinoLogger(QuizAnalyticsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getQuizAnalytics(quizId: string): Promise<QuizAnalytics> {
    const stats = await this.analyticsRepository.getQuizStats(quizId);

    if (!stats) {
      throw new QuizNotFoundError(quizId);
    }

    return {
      quizId,
      metrics: {
        totalAttempts: Number(stats.totalAttempts),
        uniquePlayers: Number(stats.totalPlayers),
        averageScore: Number(stats.avgScorePercent),
        completionRate: Number(stats.completionRate),
      },
      reviewMetrics: {
        averageRating: Number(stats.avgRating),
        ratingCount: Number(stats.ratingCount),
      },
      engagementMetrics: {
        bookmarkCount: Number(stats.bookmarkCount),
      },
      popularity: {
        popularityScore: Number(stats.popularityScore),
        trendingScore: Number(stats.trendingScore),
      },
      lastUpdated: stats.lastCalculatedAt ?? stats.updatedAt,
    };
  }

  async refreshQuizMetrics(quizId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const [totalAttempts, uniquePlayers, averageScore, completionRate] = await Promise.all([
      this.metricsRepository.calculateTotalAttempts(quizId),
      this.metricsRepository.calculateUniquePlayers(quizId),
      this.metricsRepository.calculateAverageScore(quizId),
      this.metricsRepository.calculateCompletionRate(quizId),
    ]);

    await this.analyticsRepository.upsertQuizStats(quizId, {
      totalAttempts,
      totalPlayers: uniquePlayers,
      avgScorePercent: String(averageScore.toFixed(2)),
      completionRate: String(completionRate.toFixed(2)),
      lastAttemptAt: nowIso,
      lastCalculatedAt: nowIso,
    });

    this.logger.info({
      event: 'quiz_metrics_refreshed',
      quizId,
      totalAttempts,
      uniquePlayers,
      averageScore,
      completionRate,
    });
  }

  async refreshReviewMetrics(quizId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const [averageRating, ratingCount] = await Promise.all([
      this.metricsRepository.calculateAverageRating(quizId),
      this.metricsRepository.calculateRatingCount(quizId),
    ]);

    await this.analyticsRepository.upsertQuizStats(quizId, {
      avgRating: String(averageRating.toFixed(2)),
      ratingCount,
      lastCalculatedAt: nowIso,
    });

    this.logger.info({
      event: 'review_metrics_refreshed',
      quizId,
      averageRating,
      ratingCount,
    });
  }

  /**
   * Port-side entry point for `review.submitted` notifications from the Review module.
   * Delegates to {@link refreshReviewMetrics} but isolates the failure to the port
   * boundary so a bad payload can't tear down the listener.
   */
  async onReviewSubmitted(quizId: string): Promise<void> {
    try {
      await this.refreshReviewMetrics(quizId);
      this.logger.debug({
        event: 'analytics_review_submitted',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_submitted_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Port-side entry point for `review.deleted` notifications from the Review module.
   * See {@link onReviewSubmitted} for the rationale behind the try/catch.
   */
  async onReviewDeleted(quizId: string): Promise<void> {
    try {
      await this.refreshReviewMetrics(quizId);
      this.logger.debug({
        event: 'analytics_review_deleted',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_deleted_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refreshBookmarkMetrics(quizId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const bookmarkCount = await this.metricsRepository.calculateBookmarkCount(quizId);

    await this.analyticsRepository.upsertQuizStats(quizId, {
      bookmarkCount,
      lastCalculatedAt: nowIso,
    });

    this.logger.info({
      event: 'bookmark_metrics_refreshed',
      quizId,
      bookmarkCount,
    });
  }

  async refreshAllBookmarkMetrics(): Promise<{
    quizzesEvaluated: number;
    quizzesRefreshed: number;
    errorCount: number;
  }> {
    const quizIds = await this.analyticsRepository.getAllActiveQuizIds();
    let quizzesRefreshed = 0;
    let errorCount = 0;

    for (const quizId of quizIds) {
      try {
        await this.refreshBookmarkMetrics(quizId);
        quizzesRefreshed += 1;
      } catch (error) {
        errorCount += 1;
        this.logger.error({
          event: 'bookmark_metrics_backfill_quiz_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      quizzesEvaluated: quizIds.length,
      quizzesRefreshed,
      errorCount,
    };
  }

  async refreshTrendingScore(quizId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const trendingScore = await this.trendingService.calculateTrendingScore(quizId);

    await this.analyticsRepository.upsertQuizStats(quizId, {
      trendingScore: String(trendingScore.toFixed(4)),
      lastCalculatedAt: nowIso,
    });

    this.logger.info({
      event: 'trending_score_refreshed',
      quizId,
      trendingScore,
    });
  }

  async refreshPopularityScore(quizId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const popularityScore = await this.popularityService.calculatePopularityScore(quizId);

    await this.analyticsRepository.upsertQuizStats(quizId, {
      popularityScore: String(popularityScore.toFixed(4)),
      lastCalculatedAt: nowIso,
    });

    this.logger.info({
      event: 'popularity_score_refreshed',
      quizId,
      popularityScore,
    });
  }

  /**
   * Remove all cached analytics for a deleted quiz.
   * Called by QuizDomainEventBootstrapService when a `quiz.deleted` event is received.
   *
   * Trending/popularity leaderboards are computed on-demand and JOIN on the
   * `quizzes` table with `deletedAt IS NULL`, so a deleted quiz is already
   * excluded from those queries. Removing the `quizStats` row is the
   * additional step needed to keep the analytics tables consistent and
   * free up storage.
   */
  async invalidateQuizMetrics(quizId: string): Promise<void> {
    try {
      await this.analyticsRepository.deleteQuizStats(quizId);

      this.logger.info({
        event: 'quiz_metrics_invalidated',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'quiz_metrics_invalidation_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Refresh per-quiz analytics for every quiz in the given category.
   * Called by CategoryEventBootstrapService when a category is created, updated,
   * deleted, or restored — the category's trending rank can change and downstream
   * leaderboards (trending/popular quizzes filtered by category) need to pick that up.
   *
   * Failures are logged but do not throw — the category event has already been
   * persisted at this point and a failed analytics refresh is recoverable on the
   * next periodic rebuild.
   */
  async invalidateCategoryAnalytics(categoryId: string): Promise<void> {
    try {
      const quizIds = await this.analyticsRepository.getQuizIdsByCategory(categoryId);

      if (quizIds.length === 0) {
        this.logger.info({
          event: 'category_analytics_invalidated_no_quizzes',
          categoryId,
        });
        return;
      }

      await Promise.allSettled(quizIds.map((quizId) => this.refreshQuizMetrics(quizId)));

      this.logger.info({
        event: 'category_analytics_invalidated',
        categoryId,
        quizCount: quizIds.length,
      });
    } catch (error) {
      this.logger.error({
        event: 'category_analytics_invalidation_failed',
        categoryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refreshAllTrendingScores(): Promise<void> {
    this.logger.info({ event: 'refresh_all_trending_scores_start' });

    const allStats = await this.analyticsRepository.getAllQuizStats();
    const quizIds = allStats.map((s) => s.quizId);

    const scores = await this.trendingService.refreshTrendingScores(quizIds);
    const nowIso = new Date().toISOString();

    await this.analyticsRepository.batchUpsertQuizStats(
      Array.from(scores.entries()).map(([quizId, score]) => ({
        quizId,
        data: {
          trendingScore: String(score.toFixed(4)),
          lastCalculatedAt: nowIso,
        },
      })),
    );

    this.logger.info({
      event: 'refresh_all_trending_scores_complete',
      quizCount: scores.size,
    });
  }

  async refreshAllPopularityScores(): Promise<void> {
    this.logger.info({ event: 'refresh_all_popularity_scores_start' });

    const allStats = await this.analyticsRepository.getAllQuizStats();
    const quizIds = allStats.map((s) => s.quizId);

    const scores = await this.popularityService.refreshPopularityScores(quizIds);
    const nowIso = new Date().toISOString();

    await this.analyticsRepository.batchUpsertQuizStats(
      Array.from(scores.entries()).map(([quizId, score]) => ({
        quizId,
        data: {
          popularityScore: String(score.toFixed(4)),
          lastCalculatedAt: nowIso,
        },
      })),
    );

    this.logger.info({
      event: 'refresh_all_popularity_scores_complete',
      quizCount: scores.size,
    });
  }

  async getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]> {
    return this.analyticsRepository.getTrendingQuizzes(limit, categoryId);
  }

  async getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]> {
    return this.analyticsRepository.getPopularQuizzes(limit, categoryId);
  }

  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null> {
    return this.analyticsRepository.getCategoryAnalytics(categoryId);
  }

  async getCreatorAnalytics(userId: string): Promise<CreatorAnalytics | null> {
    return this.analyticsRepository.getCreatorAnalytics(userId);
  }

  async getTagAnalytics(tagId: string): Promise<TagAnalytics | null> {
    return this.analyticsRepository.getTagAnalytics(tagId);
  }

  /**
   * Defense-in-depth reconciliation for `quiz_stats.total_attempts` and
   * `avg_score_percent`. The inline path inside
   * `AttemptRepository.completeAttemptAndSideEffects` increments these inside
   * the attempt-completion transaction, but a process crash, a manual
   * `UPDATE quiz_attempts`, or any future schema change can desynchronize the
   * running counter from the source-of-truth aggregation.
   *
   * Iterates every active quiz (including ones that have no `quiz_stats` row
   * yet) and recomputes the attempt-side counters from
   * `quiz_attempts` + `quiz_versions` via `refreshQuizMetrics`. Per-quiz
   * failures are logged and swallowed so a single broken row cannot stop the
   * sweep — the next daily cron will retry it.
   */
  async reconcileAllQuizMetrics(): Promise<{
    quizzesEvaluated: number;
    quizzesRefreshed: number;
    errorCount: number;
  }> {
    const quizIds = await this.analyticsRepository.getAllActiveQuizIds();

    let quizzesRefreshed = 0;
    let errorCount = 0;

    for (const quizId of quizIds) {
      try {
        await this.refreshQuizMetrics(quizId);
        quizzesRefreshed += 1;
      } catch (error) {
        errorCount += 1;
        this.logger.error({
          event: 'quiz_metrics_reconcile_quiz_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      quizzesEvaluated: quizIds.length,
      quizzesRefreshed,
      errorCount,
    };
  }

  /**
   * Phase 1 / Issue #9 — daily reconciliation of `quiz_stats.avg_rating`
   * and `rating_count`.
   *
   * The denormalized review counters are normally refreshed in
   * `refreshReviewMetrics` whenever a review is created or deleted.
   * That path runs through the transactional outbox (see
   * `ReviewOutboxProcessorService`), so it is durable. However, it
   * only handles events the application observed. Drift can still
   * happen when:
   *
   *   - a manual SQL fix in production re-computes a counter to the
   *     wrong value,
   *   - a future schema change touches `quiz_reviews` (e.g. a bulk
   *     backfill) without firing the outbox,
   *   - an outbox row is moved to the DLQ and never retried.
   *
   * The daily sweep re-reads every quiz's reviews and writes the
   * correct `avg_rating` / `rating_count` back into `quiz_stats`,
   * healing whatever drift accumulated since the last sweep.
   *
   * This mirrors `reconcileAllQuizMetrics` which already reconciles
   * `total_attempts` / `avg_score_percent`. The two methods share the
   * same iteration strategy (`getAllActiveQuizIds` + per-quiz refresh)
   * so they can be invoked independently.
   */
  async reconcileAllReviewMetrics(): Promise<{
    quizzesEvaluated: number;
    quizzesRefreshed: number;
    errorCount: number;
  }> {
    const quizIds = await this.analyticsRepository.getAllActiveQuizIds();

    let quizzesRefreshed = 0;
    let errorCount = 0;

    for (const quizId of quizIds) {
      try {
        await this.refreshReviewMetrics(quizId);
        quizzesRefreshed += 1;
      } catch (error) {
        errorCount += 1;
        this.logger.error({
          event: 'review_metrics_reconcile_quiz_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      quizzesEvaluated: quizIds.length,
      quizzesRefreshed,
      errorCount,
    };
  }

  /**
   * Rebuild all metrics for all quizzes
   * Used for weekly full rebuild
   */
  async rebuildAllMetrics(): Promise<void> {
    this.logger.info({ event: 'rebuild_all_metrics_start' });

    const allStats = await this.analyticsRepository.getAllQuizStats();

    for (const stat of allStats) {
      const quizId = stat.quizId;

      try {
        await Promise.all([
          this.refreshQuizMetrics(quizId),
          this.refreshReviewMetrics(quizId),
          this.refreshBookmarkMetrics(quizId),
          this.refreshTrendingScore(quizId),
          this.refreshPopularityScore(quizId),
        ]);
      } catch (error) {
        this.logger.error({
          event: 'rebuild_quiz_metrics_failed',
          quizId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info({
      event: 'rebuild_all_metrics_complete',
      quizCount: allStats.length,
    });
  }

  /**
   * Validate metrics data for inconsistencies
   * Used for daily validation
   */
  async validateMetrics(): Promise<{ issues: string[] }> {
    this.logger.info({ event: 'validate_metrics_start' });
    const issues: string[] = [];

    const allStats = await this.analyticsRepository.getAllQuizStats();

    for (const stat of allStats) {
      const quizId = stat.quizId;

      // Check for negative values
      if (Number(stat.totalAttempts) < 0) {
        issues.push(`Quiz ${quizId}: negative totalAttempts`);
      }
      if (Number(stat.totalPlayers) < 0) {
        issues.push(`Quiz ${quizId}: negative totalPlayers`);
      }
      if (Number(stat.avgScorePercent) < 0 || Number(stat.avgScorePercent) > 100) {
        issues.push(`Quiz ${quizId}: invalid avgScorePercent`);
      }
      if (Number(stat.avgRating) < 0 || Number(stat.avgRating) > 5) {
        issues.push(`Quiz ${quizId}: invalid avgRating`);
      }

      // Check for stale data
      if (stat.lastCalculatedAt) {
        const lastCalc = new Date(stat.lastCalculatedAt);
        const daysSinceCalc = (Date.now() - lastCalc.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCalc > 30) {
          issues.push(`Quiz ${quizId}: stale data (${daysSinceCalc.toFixed(0)} days)`);
        }
      }
    }

    if (issues.length > 0) {
      this.logger.warn({
        event: 'validate_metrics_issues_found',
        issueCount: issues.length,
        issues: issues.slice(0, 10), // Log first 10 issues
      });
    } else {
      this.logger.info({ event: 'validate_metrics_no_issues' });
    }

    return { issues };
  }
}
