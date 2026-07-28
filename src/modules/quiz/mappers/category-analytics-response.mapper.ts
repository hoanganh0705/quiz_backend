import type { CategoryAnalytics } from '../domain/analytics/types';
import type { CategoryAnalyticsResponseDto } from '@/modules/category/dto/response/category-analytics-response.dto';

export class CategoryAnalyticsResponseMapper {
  static toResponse(analytics: CategoryAnalytics): CategoryAnalyticsResponseDto {
    return {
      categoryId: analytics.categoryId,
      categoryName: analytics.categoryName,
      summary: {
        totalQuizzes: analytics.summary.totalQuizzes,
        activeQuizzes: analytics.summary.activeQuizzes,
        totalAttempts: analytics.summary.totalAttempts,
        uniquePlayers: analytics.summary.uniquePlayers,
        averageScore: analytics.summary.averageScore,
        averageRating: analytics.summary.averageRating,
      },
      topQuizzes: analytics.topQuizzes.map((quiz) => ({
        rank: quiz.rank,
        quizId: quiz.quizId,
        title: quiz.title,
        slug: quiz.slug,
        imageUrl: quiz.imageUrl,
        popularityScore: quiz.popularityScore,
        totalAttempts: quiz.totalAttempts,
        averageRating: quiz.averageRating,
        bookmarkCount: quiz.bookmarkCount,
      })),
      lastUpdated: analytics.lastUpdated,
    };
  }
}
