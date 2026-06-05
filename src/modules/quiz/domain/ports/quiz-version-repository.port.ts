import type { QuizDifficulty, QuizVersionStatus } from '../../types/quiz.types';
import type { UpdateQuizVersionCommand } from '../types/quiz-version-commands';

export type QuizVersionRow = {
  quizVersionId: string;
  quizId: string;
  versionNumber: number;
  status: QuizVersionStatus;
  difficulty: QuizDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
  createdByUserId: string | null;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type QuizVersionDetailRow = QuizVersionRow & {
  title: string;
  description: string | null;
  quizCreatorId: string | null;
  quizIsVerified: boolean;
  quizIsHidden: boolean;
};

export type QuizVersionCursor = {
  createdAt: string;
  quizVersionId: string;
};

export interface QuizVersionRepositoryPort {
  getQuizVersionDetailById(quizVersionId: string): Promise<QuizVersionDetailRow | null>;

  getQuizVersionDetailByQuizId(params: {
    quizId: string;
    quizVersionId: string;
  }): Promise<QuizVersionDetailRow | null>;

  getQuizVersionById(quizVersionId: string): Promise<QuizVersionRow | null>;

  listQuizVersions(params: {
    quizId: string;
    limit: number;
    cursor?: QuizVersionCursor | null;
  }): Promise<QuizVersionRow[]>;

  createQuizVersion(params: {
    quizId: string;
    versionNumber: number;
    difficulty: QuizDifficulty;
    durationMs: number;
    passingScorePercent: number;
    rewardXp: number;
    createdByUserId: string;
    nowIso: string;
  }): Promise<QuizVersionRow>;

  createDraftFromSourceVersion(params: {
    sourceVersion: QuizVersionDetailRow;
    userId: string;
    command?: UpdateQuizVersionCommand;
    nowIso: string;
  }): Promise<QuizVersionRow>;

  getNextVersionNumber(quizId: string): Promise<number>;

  updateQuizVersion(params: {
    quizVersionId: string;
    patch: {
      difficulty: QuizDifficulty;
      durationMs: number;
      passingScorePercent: number;
      rewardXp: number;
      updatedAt: string;
    };
  }): Promise<void>;

  /**
   * @transactional
   * Archives the currently published version and publishes the target version in a single atomic transaction.
   * Also updates the quiz's publishedVersionId FK.
   * If any step fails, the entire operation is rolled back.
   */
  publishQuizVersionAndSetQuiz(params: {
    quizId: string;
    quizVersionId: string;
    nowIso: string;
  }): Promise<QuizVersionRow | null>;

  /**
   * @transactional
   * Creates a new draft version by deep-copying all questions from the source version.
   * The entire copy operation (version + questions + options) is atomic.
   */
  createDraftFromSourceVersion(params: {
    sourceVersion: QuizVersionDetailRow;
    userId: string;
    command?: UpdateQuizVersionCommand;
    nowIso: string;
  }): Promise<QuizVersionRow>;
}

export const QUIZ_VERSION_REPOSITORY_PORT = Symbol('QUIZ_VERSION_REPOSITORY_PORT');
