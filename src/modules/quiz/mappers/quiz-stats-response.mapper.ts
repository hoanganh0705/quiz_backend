import type { QuizStats } from '../domain/types';
import type { QuizStatsResponseDto } from '../dto/response/quiz-stats-response.dto';

export class QuizStatsResponseMapper {
  static toResponse(stats: QuizStats): QuizStatsResponseDto {
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
    };
  }
}
