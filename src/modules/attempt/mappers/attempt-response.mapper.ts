import { Injectable } from '@nestjs/common';
import {
  AttemptResponseDto,
  AttemptSummaryResponseDto,
  AttemptAnswerResponseDto,
  AttemptAnswerItemDto,
  AttemptAnswersResponseDto,
  AttemptAnalyticsResponseDto,
  UserAttemptStatsResponseDto,
} from '../dto/response';
import type { AttemptDetailRow, AttemptAnswerRow, AttemptAnalyticsRow, UserAttemptStatsRow } from '../domain/ports';
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
   * Maps raw answer rows to the GET /attempts/:attemptId/answers response shape.
   *
   * `selectedOptionIds` is modelled as an array (0 or 1 element) because the schema
   * stores one option per answer row (`selected_option_id` is nullable uuid).
   * `submittedAt` aliases `answeredAt` to match the public contract.
   */
  toAttemptAnswersResponse(
    attemptId: string,
    answers: AttemptAnswerRow[],
  ): AttemptAnswersResponseDto {
    return {
      attemptId,
      answers: answers.map(
        (a): AttemptAnswerItemDto => ({
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionId ? [a.selectedOptionId] : [],
          isCorrect: a.isCorrect,
          submittedAt: a.answeredAt,
        }),
      ),
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

  /**
   * Maps an AttemptAnalyticsRow to AttemptAnalyticsResponseDto.
   *
   * Derived fields computed here:
   *  - accuracy       = (correctCount / totalQuestions) * 100
   *  - incorrectAnswers = answeredQuestions − correctCount
   *  - unansweredQuestions = totalQuestions − answeredQuestions
   *  - timeSpentSeconds = timeTakenMs / 1000
   */
  toAttemptAnalyticsResponse(
    row: AttemptAnalyticsRow,
    answeredCount: number,
  ): AttemptAnalyticsResponseDto {
    const correctAnswers = row.correctCount;
    const total = row.totalQuestions;
    const answered = answeredCount;

    const incorrectAnswers =
      correctAnswers !== null ? Math.max(0, answered - correctAnswers) : null;

    const unansweredQuestions = Math.max(0, total - answered);

    const accuracy =
      correctAnswers !== null && total > 0
        ? Number(((correctAnswers / total) * 100).toFixed(2))
        : null;

    const timeSpentSeconds =
      row.timeTakenMs !== null ? Number((row.timeTakenMs / 1000).toFixed(2)) : null;

    return {
      attemptId: row.attemptId,
      score: row.scorePercent !== null ? Number(parseFloat(row.scorePercent).toFixed(2)) : null,
      accuracy,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      timeSpentSeconds,
      percentileRank: row.percentileRank,
      completedAt: row.finishedAt,
    };
  }

  /**
   * Maps UserAttemptStatsRow to UserAttemptStatsResponseDto.
   *
   * Derived fields:
   *  - averageAccuracy mirrors averageScore (score already represents percent-correct)
   *  - totalTimeSpentSeconds = totalTimeTakenMs / 1000
   */
  toUserAttemptStatsResponse(row: UserAttemptStatsRow): UserAttemptStatsResponseDto {
    return {
      totalAttempts: row.totalAttempts,
      completedAttempts: row.completedAttempts,
      abandonedAttempts: row.abandonedAttempts,
      averageScore: Number(row.averageScore.toFixed(2)),
      averageAccuracy: Number(row.averageScore.toFixed(2)),
      totalTimeSpentSeconds: Number((row.totalTimeTakenMs / 1000).toFixed(2)),
      favoriteCategory: row.favoriteCategory,
      favoriteTag: row.favoriteTag,
      lastAttemptAt: row.lastAttemptAt,
    };
  }
}
