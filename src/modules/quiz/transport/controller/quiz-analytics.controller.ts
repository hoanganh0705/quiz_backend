import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import {
  QuizAnalyticsResponseDto,
  TrendingQuizzesResponseDto,
  PopularQuizzesResponseDto,
  CreatorQuizAnalyticsDto,
} from '@/modules/quiz/dto/response';

@Controller()
export class QuizAnalyticsController {
  constructor(private readonly quizAnalyticsService: QuizAnalyticsService) {}

  @Get('quizzes/:quizId/analytics')
  async getQuizAnalytics(@Param('quizId') quizId: string): Promise<QuizAnalyticsResponseDto> {
    const analytics = await this.quizAnalyticsService.getQuizAnalytics(quizId);

    return {
      quizId: analytics.quizId,
      metrics: {
        totalAttempts: analytics.metrics.totalAttempts,
        uniquePlayers: analytics.metrics.uniquePlayers,
        averageScore: analytics.metrics.averageScore,
        completionRate: analytics.metrics.completionRate,
      },
      reviewMetrics: {
        averageRating: analytics.reviewMetrics.averageRating,
        ratingCount: analytics.reviewMetrics.ratingCount,
      },
      engagementMetrics: {
        bookmarkCount: analytics.engagementMetrics.bookmarkCount,
      },
      popularity: {
        popularityScore: analytics.popularity.popularityScore,
        trendingScore: analytics.popularity.trendingScore,
        rank: analytics.popularity.rank,
      },
      lastUpdated: analytics.lastUpdated,
    };
  }

  @Get('analytics/trending')
  async getTrendingQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<TrendingQuizzesResponseDto> {
    const quizzes = await this.quizAnalyticsService.getTrendingQuizzes(limit, categoryId);

    return {
      period: 'weekly',
      quizzes: quizzes.map((q) => ({
        rank: q.rank,
        quizId: q.quizId,
        title: q.title,
        slug: q.slug,
        imageUrl: q.imageUrl,
        trendingScore: q.trendingScore,
        totalAttempts: q.totalAttempts,
        recentAttempts: q.recentAttempts,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  @Get('analytics/popular')
  async getPopularQuizzes(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('categoryId') categoryId?: string,
  ): Promise<PopularQuizzesResponseDto> {
    const quizzes = await this.quizAnalyticsService.getPopularQuizzes(limit, categoryId);

    return {
      quizzes: quizzes.map((q) => ({
        rank: q.rank,
        quizId: q.quizId,
        title: q.title,
        slug: q.slug,
        imageUrl: q.imageUrl,
        popularityScore: q.popularityScore,
        totalAttempts: q.totalAttempts,
        averageRating: q.averageRating,
        bookmarkCount: q.bookmarkCount,
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  @Get('analytics/creator/:userId')
  async getCreatorAnalytics(
    @Param('userId') userId: string,
  ): Promise<CreatorQuizAnalyticsDto | null> {
    const analytics = await this.quizAnalyticsService.getCreatorAnalytics(userId);

    if (!analytics) {
      return null;
    }

    return {
      userId: analytics.userId,
      totalQuizzes: analytics.totalQuizzes,
      draftQuizzes: analytics.draftQuizzes,
      publishedQuizzes: analytics.publishedQuizzes,
      totalAttempts: analytics.totalAttempts,
      totalPlayers: analytics.totalPlayers,
      averageScore: analytics.averageScore,
      averageRating: analytics.averageRating,
      totalBookmarks: analytics.totalBookmarks,
      totalReviews: analytics.totalReviews,
      lastUpdated: analytics.lastUpdated,
    };
  }
}
