import { Injectable } from '@nestjs/common';
import { QuizVersionResponseDto } from '../dto/response/quiz-version-response.dto';
import type { QuizVersionRow } from '../domain/ports/quiz-version-repository.port';

@Injectable()
export class QuizVersionResponseMapper {
  toQuizVersionResponse(row: QuizVersionRow): QuizVersionResponseDto {
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
