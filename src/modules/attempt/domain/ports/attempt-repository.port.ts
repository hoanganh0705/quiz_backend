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

export interface AttemptRepositoryPort {
  getAttemptById(attemptId: string): Promise<AttemptRow | null>;

  getAttemptDetailById(attemptId: string): Promise<AttemptDetailRow | null>;

  getActiveAttemptByUserAndVersion(userId: string, quizVersionId: string): Promise<AttemptRow | null>;

  listAttemptsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { startedAt: string; attemptId: string } | null;
  }): Promise<AttemptRow[]>;

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
}

export const ATTEMPT_REPOSITORY_PORT = Symbol('ATTEMPT_REPOSITORY_PORT');
