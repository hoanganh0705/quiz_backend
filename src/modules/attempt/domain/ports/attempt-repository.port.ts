import type { AttemptStatus, AttemptContextType } from '../../types/attempt.types';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';

export type AttemptRow = {
  attemptId: string;
  userId: string;
  quizVersionId: string;
  contextType: AttemptContextType;
  contextRefId: string | null;
  status: AttemptStatus;
  scorePercent: string | null;
  correctCount: number | null;
  startedAt: string;
  finishedAt: string | null;
  timeTakenMs: number | null;
  xpEarned: number;
  createdAt: string;
  updatedAt: string;
};

export type AttemptDetailRow = AttemptRow & {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  quizCreatorId: string | null;
  versionNumber: number;
  difficulty: QuizDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
};

export type AttemptWithAnswersRow = AttemptRow & {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  versionNumber: number;
  difficulty: QuizDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
};

export type AttemptAnswerRow = {
  attemptAnswerId: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  answeredAt: string;
  timeTakenMs: number | null;
  optionPosition: number | null;
  optionValue: string | null;
  isCorrect: boolean | null;
};

export type AttemptListRow = {
  attemptId: string;
  userId: string;
  quizVersionId: string;
  contextType: AttemptContextType;
  contextRefId: string | null;
  status: AttemptStatus;
  scorePercent: string | null;
  correctCount: number | null;
  startedAt: string;
  finishedAt: string | null;
  timeTakenMs: number | null;
  xpEarned: number;
  createdAt: string;
  updatedAt: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  versionNumber: number;
  difficulty: QuizDifficulty;
};

export interface AttemptRepositoryPort {
  getAttemptById(attemptId: string): Promise<AttemptRow | null>;

  getAttemptDetailById(attemptId: string): Promise<AttemptDetailRow | null>;

  getActiveAttemptByUserAndVersion(
    userId: string,
    quizVersionId: string,
  ): Promise<AttemptRow | null>;

  listAttemptsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { startedAt: string; attemptId: string } | null;
  }): Promise<AttemptListRow[]>;

  createAttempt(params: {
    userId: string;
    quizVersionId: string;
    contextType: AttemptContextType;
    contextRefId: string | null;
    nowIso: string;
  }): Promise<AttemptRow>;

  abandonAttempt(params: {
    attemptId: string;
    userId: string;
    nowIso: string;
  }): Promise<AttemptRow>;

  getAttemptAnswersByAttemptId(attemptId: string): Promise<AttemptAnswerRow[]>;

  submitAnswer(params: {
    attemptId: string;
    userId: string;
    questionId: string;
    selectedOptionId: string | null;
    nowIso: string;
    timeTakenMs?: number | null;
  }): Promise<AttemptAnswerRow>;

  checkAnswerOptionBelongsToQuestion(questionId: string, optionId: string): Promise<boolean>;

  checkAnswerExists(attemptId: string, questionId: string): Promise<boolean>;

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

  completeAttempt(params: {
    attemptId: string;
    scorePercent: string;
    correctCount: number;
    timeTakenMs: number;
    xpEarned: number;
    nowIso: string;
  }): Promise<AttemptRow>;

  upsertQuizStats(params: { quizId: string; scorePercent: string; nowIso: string }): Promise<void>;

  addUserXp(params: { userId: string; xpToAdd: number }): Promise<void>;

  createTournamentAttempt(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    nowIso: string;
  }): Promise<AttemptRow>;
}

export const ATTEMPT_REPOSITORY_PORT = Symbol('ATTEMPT_REPOSITORY_PORT');
