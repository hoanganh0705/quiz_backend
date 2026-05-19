import type { QuizDifficulty, QuizVersionStatus } from '../../types/quiz.types';
import type { UpdateQuizVersionDto } from '../../dto/request/update-quiz-version.dto';

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
    payload?: UpdateQuizVersionDto;
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

  publishQuizVersionAndSetQuiz(params: {
    quizId: string;
    quizVersionId: string;
    nowIso: string;
  }): Promise<QuizVersionRow | null>;
}

export const QUIZ_VERSION_REPOSITORY_PORT = Symbol('QUIZ_VERSION_REPOSITORY_PORT');
