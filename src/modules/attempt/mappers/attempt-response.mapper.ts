import { Injectable } from '@nestjs/common';
import {
  AttemptResponseDto,
  AttemptSummaryResponseDto,
  AttemptAnswerResponseDto,
  AttemptAnswerItemDto,
  AttemptAnswersResponseDto,
  AttemptAnalyticsResponseDto,
  UserAttemptStatsResponseDto,
  AttemptReviewResponseDto,
  AttemptReviewQuestionDto,
} from '../dto/response';
import type {
  AttemptDetailRow,
  AttemptAnswerRow,
  AttemptAnalyticsRow,
  UserAttemptStatsRow,
} from '../domain/ports';
import type { AttemptListRow } from '../domain/ports';
import { AttemptStatusEnum, AttemptContextTypeEnum } from '../types/attempt.types';

/**
 * Shape of a flat row from `quizQuestionRepository.getQuestionsByVersionId`.
 * Mirrors `QuizQuestionJoinRow` from the quiz module — duplicated locally so
 * the attempt module does not need to import quiz-module internal types.
 */
type QuestionJoinRow = {
  questionId: string;
  quizVersionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  optionId: string | null;
  optionPosition: number | null;
  optionValue: string | null;
  optionIsCorrect: boolean | null;
  optionCreatedAt: string | null;
};

@Injectable()
export class AttemptResponseMapper {
  toAttemptDetailResponse(
    attempt: AttemptDetailRow,
    answers: AttemptAnswerRow[],
  ): AttemptResponseDto {
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
      contextType: attempt.contextType as AttemptContextTypeEnum,
      contextRefId: attempt.contextRefId,
      status: attempt.status as AttemptStatusEnum,
      scorePercent:
        attempt.scorePercent !== null ? Number(parseFloat(attempt.scorePercent).toFixed(2)) : null,
      correctCount: attempt.correctCount,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      timeTakenMs: attempt.timeTakenMs,
      xpEarned: attempt.xpEarned,
      answers: answers.map(
        (a): AttemptAnswerResponseDto => ({
          attemptAnswerId: a.attemptAnswerId,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          answeredAt: a.answeredAt,
          timeTakenMs: a.timeTakenMs,
        }),
      ),
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
      contextType: attempt.contextType as AttemptContextTypeEnum,
      status: attempt.status as AttemptStatusEnum,
      scorePercent:
        attempt.scorePercent !== null ? Number(parseFloat(attempt.scorePercent).toFixed(2)) : null,
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
          selectedOptionId: a.selectedOptionId,
          submittedAt: a.answeredAt,
        }),
      ),
    };
  }

  /**
   * Maps the post-attempt review input (an attempt, its submitted answers, and
   * the quiz version's questions+options) into AttemptReviewResponseDto.
   *
   * Per-question composition:
   *   - Hydrates the flat `questionRows` into question objects (grouping options).
   *   - Looks up the user's submitted answer by questionId.
   *   - Computes `isCorrect` per question by matching the user's
   *     `selectedOptionId` against the option flagged with `isCorrect: true`.
   *     This is the same source of truth as `getAttemptAnswerScoringData`
   *     used at completion time — no duplicate grading logic.
   *
   * Questions appear in the order the quiz author defined them (the underlying
   * repository ORDER BYs on `quizQuestions.position`). Unanswered questions
   * appear in the response with `selectedOptionId: null` and `isCorrect: null`.
   */
  toAttemptReviewResponse(
    attempt: AttemptDetailRow,
    answers: AttemptAnswerRow[],
    questionRows: QuestionJoinRow[],
  ): AttemptReviewResponseDto {
    const answerByQuestion = new Map<string, AttemptAnswerRow>(
      answers.map((a) => [a.questionId, a]),
    );

    const questions = this.hydrateQuestions(questionRows).map((q): AttemptReviewQuestionDto => {
      const userAnswer = answerByQuestion.get(q.questionId) ?? null;
      const correctOption = q.answerOptions.find((o) => o.isCorrect);

      let isCorrect: boolean | null = null;
      if (userAnswer && userAnswer.selectedOptionId !== null) {
        isCorrect = correctOption?.optionId === userAnswer.selectedOptionId;
      }

      return {
        questionId: q.questionId,
        position: q.position,
        questionText: q.questionText,
        imageUrl: q.imageUrl,
        selectedOptionId: userAnswer?.selectedOptionId ?? null,
        isCorrect,
        timeTakenMs: userAnswer?.timeTakenMs ?? null,
        answeredAt: userAnswer?.answeredAt ?? new Date(0).toISOString(),
        answerOptions: q.answerOptions.map((o) => ({
          optionId: o.optionId,
          position: o.position,
          value: o.value,
          isCorrect: o.isCorrect,
        })),
        // Extensibility hooks — populated by future features (per-option
        // rationale, topic tags, per-question difficulty). Null today.
        explanation: null,
        topicTags: null,
        difficulty: null,
      };
    });

    return {
      attemptId: attempt.attemptId,
      status: 'completed',
      quizId: attempt.quizId,
      quizTitle: attempt.quizTitle,
      quizSlug: attempt.quizSlug,
      versionNumber: attempt.versionNumber,
      difficulty: attempt.difficulty,
      passingScorePercent: attempt.passingScorePercent,
      scorePercent:
        attempt.scorePercent !== null ? Number(parseFloat(attempt.scorePercent).toFixed(2)) : null,
      correctCount: attempt.correctCount,
      totalQuestions: questions.length,
      timeTakenMs: attempt.timeTakenMs,
      xpEarned: attempt.xpEarned,
      finishedAt: attempt.finishedAt ?? new Date(0).toISOString(),
      questions,
    };
  }

  /**
   * Groups flat `QuizQuestionJoinRow[]` rows (one row per option) into
   * structured question objects. Mirrors the quiz module's hydrator so the
   * attempt module can compose the review without depending on quiz module
   * internals.
   */
  private hydrateQuestions(rows: QuestionJoinRow[]): Array<{
    questionId: string;
    quizVersionId: string;
    position: number;
    questionText: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    answerOptions: Array<{
      optionId: string;
      position: number;
      value: string;
      isCorrect: boolean;
      createdAt: string;
    }>;
  }> {
    const byId = new Map<
      string,
      {
        questionId: string;
        quizVersionId: string;
        position: number;
        questionText: string;
        imageUrl: string | null;
        createdAt: string;
        updatedAt: string;
        answerOptions: Array<{
          optionId: string;
          position: number;
          value: string;
          isCorrect: boolean;
          createdAt: string;
        }>;
      }
    >();

    for (const row of rows) {
      let q = byId.get(row.questionId);
      if (!q) {
        q = {
          questionId: row.questionId,
          quizVersionId: row.quizVersionId,
          position: row.position,
          questionText: row.questionText,
          imageUrl: row.imageUrl,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          answerOptions: [],
        };
        byId.set(row.questionId, q);
      }
      if (
        row.optionId &&
        row.optionPosition !== null &&
        row.optionValue !== null &&
        row.optionIsCorrect !== null &&
        row.optionCreatedAt
      ) {
        q.answerOptions.push({
          optionId: row.optionId,
          position: row.optionPosition,
          value: row.optionValue,
          isCorrect: row.optionIsCorrect,
          createdAt: row.optionCreatedAt,
        });
      }
    }

    return Array.from(byId.values());
  }

  /**
   * Maps an AttemptAnalyticsRow to AttemptAnalyticsResponseDto.
   *
   * Derived fields computed here:
   *  - accuracy         = (correctCount / totalQuestions) * 100
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

    // accuracy = correct / total * 100 (percentage of all questions answered correctly)
    const accuracy =
      correctAnswers !== null && total > 0
        ? Number(((correctAnswers / total) * 100).toFixed(2))
        : null;

    // incorrectAnswers = questions answered minus correct answers
    const incorrectAnswers =
      correctAnswers !== null ? Math.max(0, answered - correctAnswers) : null;

    // unansweredQuestions = total questions minus questions answered
    const unansweredQuestions = Math.max(0, total - answered);

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
      totalTimeSpentSeconds: Number((row.totalTimeTakenMs / 1000).toFixed(2)),
      favoriteCategory: row.favoriteCategory,
      favoriteTag: row.favoriteTag,
      lastAttemptAt: row.lastAttemptAt,
    };
  }
}
