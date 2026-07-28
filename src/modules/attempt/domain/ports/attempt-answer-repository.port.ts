export type AttemptAnswerRow = {
  attemptAnswerId: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: string;
  timeTakenMs: number | null;
};

export interface AttemptAnswerRepositoryPort {
  getAttemptAnswersByAttemptId(attemptId: string): Promise<AttemptAnswerRow[]>;

  /**
   * Returns a specific answer for an attempt and question, or null if not found.
   * Used to verify an answer exists before withdrawal.
   */
  getAnswerByAttemptAndQuestion(
    attemptId: string,
    questionId: string,
  ): Promise<AttemptAnswerRow | null>;

  /**
   * Returns scoring-relevant answer data (total count and correct count) for an attempt.
   * Uses a targeted INNER JOIN - no deduplication needed since we count directly.
   */
  getAttemptAnswerScoringData(
    attemptId: string,
  ): Promise<{ totalAnswers: number; correctCount: number }>;

  submitAnswer(params: {
    attemptId: string;
    questionId: string;
    selectedOptionId: string | null;
    nowIso: string;
    timeTakenMs?: number | null;
  }): Promise<AttemptAnswerRow>;

  /**
   * Deletes a submitted answer for an active attempt.
   * Only allowed on attempts with status 'started'.
   * Fails silently if no answer exists for the given question.
   */
  deleteAnswer(params: { attemptId: string; questionId: string }): Promise<void>;

  /**
   * Verifies that an answer option belongs to the specified question.
   * Used to prevent invalid option submissions.
   */
  checkAnswerOptionBelongsToQuestion(questionId: string, optionId: string): Promise<boolean>;

  /**
   * Returns the total number of questions for a given quiz version.
   * Used to enforce a minimum question count before an attempt can be started.
   */
  countQuestionsByVersionId(quizVersionId: string): Promise<number>;

  /**
   * Verifies that a question exists and belongs to the specified quiz version.
   * Used to prevent cross-quiz answer submissions and invalid question references.
   */
  checkQuestionBelongsToVersion(questionId: string, quizVersionId: string): Promise<boolean>;
}

export const ATTEMPT_ANSWER_REPOSITORY_PORT = Symbol('ATTEMPT_ANSWER_REPOSITORY_PORT');
