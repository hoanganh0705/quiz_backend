import type { AttemptStatus, AttemptContextType } from '../../types/attempt.types';
import type {
  AttemptListCursorPayload,
  AttemptListSortField,
} from '../../mappers/attempt-cursor.mapper';
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

export type AttemptAnalyticsRow = {
  attemptId: string;
  quizVersionId: string;
  scorePercent: string | null;
  correctCount: number | null;
  totalQuestions: number;
  timeTakenMs: number | null;
  percentileRank: number;
  finishedAt: string | null;
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
  sortCompletedAt: string | null;
  sortCreatedAt: string;
  sortScore: number | null;
};

export type UserAttemptStatsRow = {
  totalAttempts: number;
  completedAttempts: number;
  abandonedAttempts: number;
  averageScore: number;
  totalTimeTakenMs: number;
  lastAttemptAt: string | null;
  favoriteCategory: { categoryId: string; name: string } | null;
  favoriteTag: { tagId: string; name: string } | null;
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
    cursor?: AttemptListCursorPayload | null;
    status?: AttemptStatus;
    quizId?: string;
    categoryId?: string;
    tagId?: string;
    fromDate?: string;
    toDate?: string;
    sortBy: AttemptListSortField;
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

  /**
   * @transactional
   * Completes an attempt and all its side effects (quiz stats, XP) in a single atomic transaction.
   * All writes commit together or rollback together.
   */
  completeAttemptAndSideEffects(params: {
    attemptId: string;
    scorePercent: string;
    correctCount: number;
    timeTakenMs: number;
    xpEarned: number;
    nowIso: string;
    quizId: string;
    userId: string;
  }): Promise<AttemptRow>;

  /**
   * Returns analytics for a single completed attempt, including a percentile rank
   * computed against all other completed attempts for the same quiz version.
   */
  getAttemptAnalytics(attemptId: string): Promise<AttemptAnalyticsRow | null>;

  /**
   * Returns aggregated attempt statistics for a user.
   * Includes status counts, average score, total time, and favorite category/tag.
   * All aggregation logic lives in the repository query.
   */
  getUserAttemptStats(userId: string): Promise<UserAttemptStatsRow>;

  /**
   * Returns the number of completed attempts for a user.
   * Used to determine quiz milestone achievements.
   */
  countCompletedAttempts(userId: string): Promise<number>;
}

export const ATTEMPT_REPOSITORY_PORT = Symbol('ATTEMPT_REPOSITORY_PORT');
