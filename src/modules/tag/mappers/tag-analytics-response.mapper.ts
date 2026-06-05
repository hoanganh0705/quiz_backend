import type { TagAnalyticsResponseDto } from '../dto/response/parity-response.dto';

/**
 * Tag analytics data structure.
 * Mirrors CategoryAnalytics but scoped to a tag.
 *
 * TODO: Wire this to QuizAnalyticsService once a tag-level analytics
 * method is added to the analytics repository port.
 */
export interface TagAnalytics {
  tagId: string;
  tagName: string;
  summary: {
    totalQuizzes: number;
    activeQuizzes: number;
    totalAttempts: number;
    totalPlayers: number;
    averageScore: number;
    averageRating: number;
  };
  topQuizzes: Array<{
    rank: number;
    quizId: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    popularityScore: number;
    totalAttempts: number;
    averageRating: number;
    bookmarkCount: number;
  }>;
  lastUpdated: string;
}

export class TagAnalyticsResponseMapper {
  static toResponse(analytics: TagAnalytics): TagAnalyticsResponseDto {
    return {
      tagId: analytics.tagId,
      tagName: analytics.tagName,
      summary: {
        totalQuizzes: analytics.summary.totalQuizzes,
        activeQuizzes: analytics.summary.activeQuizzes,
        totalAttempts: analytics.summary.totalAttempts,
        totalPlayers: analytics.summary.totalPlayers,
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
