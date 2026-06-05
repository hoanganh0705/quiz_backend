import type { UserAnalytics } from '../domain/types/user-analytics';
import type { UserAnalyticsResponseDto } from '../dto/response/user-analytics-response.dto';

export class UserAnalyticsResponseMapper {
  static toResponse(analytics: UserAnalytics): UserAnalyticsResponseDto {
    return {
      userId: analytics.userId,
      summary: {
        totalAttempts: analytics.summary.totalAttempts,
        completedQuizzes: analytics.summary.completedQuizzes,
        averageScore: analytics.summary.averageScore,
      },
      favoriteCategory: analytics.favoriteCategory
        ? {
            categoryId: analytics.favoriteCategory.categoryId,
            name: analytics.favoriteCategory.name,
          }
        : null,
      favoriteTag: analytics.favoriteTag
        ? {
            tagId: analytics.favoriteTag.tagId,
            name: analytics.favoriteTag.name,
          }
        : null,
      lastUpdated: analytics.lastUpdated,
    };
  }
}
