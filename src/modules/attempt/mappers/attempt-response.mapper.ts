import { Injectable } from '@nestjs/common';
import {
  AttemptResponseDto,
  AttemptSummaryResponseDto,
  AttemptAnswerResponseDto,
} from '../dto/response';
import type { AttemptDetailRow, AttemptAnswerRow } from '../domain/ports';
import type { AttemptListRow } from '../domain/ports';

@Injectable()
export class AttemptResponseMapper {
  toAttemptDetailResponse(
    attempt: AttemptDetailRow,
    answers: AttemptAnswerRow[],
  ): AttemptResponseDto {
    const deduplicatedAnswers = this.deduplicateAnswers(answers);

    return {
      attemptId: attempt.attemptId,
      userId: attempt.userId,
      quizId: attempt.quizId,
      quizTitle: attempt.quizTitle,
      quizSlug: attempt.quizSlug,
      versionNumber: attempt.versionNumber,
      difficulty: attempt.difficulty,
      durationMs: attempt.durationMs,
      passingScorePercent: attempt.passingScorePercent,
      rewardXp: attempt.rewardXp,
      contextType: attempt.contextType,
      contextRefId: attempt.contextRefId,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      correctCount: attempt.correctCount,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      timeTakenMs: attempt.timeTakenMs,
      xpEarned: attempt.xpEarned,
      answers: deduplicatedAnswers,
    };
  }

  toAttemptSummaryResponse(attempt: AttemptListRow): AttemptSummaryResponseDto {
    return {
      attemptId: attempt.attemptId,
      quizId: attempt.quizId,
      quizTitle: attempt.quizTitle,
      quizSlug: attempt.quizSlug,
      versionNumber: attempt.versionNumber,
      difficulty: attempt.difficulty,
      contextType: attempt.contextType,
      status: attempt.status,
      scorePercent: attempt.scorePercent,
      correctCount: attempt.correctCount,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      xpEarned: attempt.xpEarned,
    };
  }

  toAttemptResponses(attempts: AttemptListRow[]): AttemptSummaryResponseDto[] {
    return attempts.map((attempt) => this.toAttemptSummaryResponse(attempt));
  }

  toSubmitAnswerResponse(answer: AttemptAnswerRow): AttemptAnswerResponseDto {
    return {
      attemptAnswerId: answer.attemptAnswerId,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      answeredAt: answer.answeredAt,
      timeTakenMs: answer.timeTakenMs,
      isCorrect: answer.isCorrect,
    };
  }

  /**
   * Deduplicates answers that may appear multiple times due to LEFT JOIN with quizAnswerOptions.
   * The quizAttemptAnswers table has one row per answer, but LEFT JOIN can produce duplicate
   * rows when joining with optional answer option data.
   */
  private deduplicateAnswers(answers: AttemptAnswerRow[]): AttemptAnswerResponseDto[] {
    const seen = new Set<string>();

    const result: AttemptAnswerResponseDto[] = [];
    for (const answer of answers) {
      if (!seen.has(answer.attemptAnswerId)) {
        seen.add(answer.attemptAnswerId);
        result.push({
          attemptAnswerId: answer.attemptAnswerId,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          answeredAt: answer.answeredAt,
          timeTakenMs: answer.timeTakenMs,
          isCorrect: answer.isCorrect,
        });
      }
    }

    return result;
  }
}
