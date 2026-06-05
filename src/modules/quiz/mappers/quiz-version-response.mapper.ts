import type { QuizVersionRow, QuizVersionDetailRow } from '../domain/ports/quiz-version-repository.port';
import type { QuizQuestionResponseDto } from '../dto/response/quiz-question-response.dto';
import type {
  QuizVersionResponseDto,
  QuizVersionDetailResponseDto,
} from '../dto/response/quiz-version-response.dto';

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

  static toQuizVersionDetailResponse(
    row: Pick<QuizVersionDetailRow, 'quizVersionId' | 'quizId' | 'versionNumber' | 'status' | 'passingScorePercent' | 'durationMs' | 'createdAt' | 'updatedAt'> & {
      title: string;
      description: string | null;
    },
    questions: QuizQuestionResponseDto[],
  ): QuizVersionDetailResponseDto {
    return {
      versionId: row.quizVersionId,
      quizId: row.quizId,
      versionNumber: row.versionNumber,
      status: row.status,
      title: row.title,
      description: row.description,
      passingScore: row.passingScorePercent,
      timeLimit: row.durationMs,
      questions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
