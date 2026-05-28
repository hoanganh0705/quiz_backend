import type { QuizVersionRow } from '../domain/ports/quiz-version-repository.port';
import type { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';

/**
 * Pure stateless mapper — no DI needed.
 * Translates QuizVersionRow database projections to QuizVersionResponseDto.
 */
export class QuizVersionResponseMapper {
  static toQuizVersionResponse(row: QuizVersionRow): QuizVersionResponseDto {
    return {
      quizVersionId: row.quizVersionId,
      quizId: row.quizId,
      versionNumber: row.versionNumber,
      status: row.status,
      difficulty: row.difficulty,
      durationMs: row.durationMs,
      passingScorePercent: row.passingScorePercent,
      rewardXp: row.rewardXp,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      updatedAt: row.updatedAt,
    };
  }
}
