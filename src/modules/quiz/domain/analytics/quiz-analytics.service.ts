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
