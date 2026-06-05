import type { CreatorAnalytics } from '@/modules/quiz/domain/analytics/types';
import type { CreatorQuizAnalyticsDto } from '../dto/response/quiz-analytics.dto';

export class CreatorQuizAnalyticsResponseMapper {
  static toResponse(analytics: CreatorAnalytics): CreatorQuizAnalyticsDto {
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
