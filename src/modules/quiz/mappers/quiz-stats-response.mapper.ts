import type { QuizStats } from '../domain/types';
import type { QuizStatsHistoryPointDto } from '../dto/response/quiz-stats-history-point.dto';
import type { QuizStatsResponseDto } from '../dto/response/quiz-stats-response.dto';

export class QuizStatsResponseMapper {
  static toResponse(
    stats: QuizStats,
    extras: {
      commentsCount: number;
      recentActivity: QuizStatsHistoryPointDto[];
    } = {
      commentsCount: 0,
      recentActivity: [],
    },
  ): QuizStatsResponseDto {
    return {
      quizId: stats.quizId,
      totalAttempts: stats.totalAttempts,
      uniquePlayers: stats.uniquePlayers,
      averageScore: stats.averageScore,
      averageRating: stats.averageRating,
      bookmarkCount: stats.bookmarkCount,
      completionRate: stats.completionRate,
      popularityScore: stats.popularityScore,
      trendingScore: stats.trendingScore,
      commentsCount: extras.commentsCount,
      recentActivity: extras.recentActivity,
    };
  }
}
