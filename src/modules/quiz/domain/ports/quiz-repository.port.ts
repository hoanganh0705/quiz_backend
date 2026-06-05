import type { QuizDifficulty, QuizVersionStatus } from '../../types/quiz.types';

export type QuizRecordRow = {
  quizId: string;
  creatorId: string | null;
};

export type QuizWithPublishedVersionRow = {
  quizId: string;
  creatorId: string | null;
  title: string;
  description: string | null;
  slug: string;
  requirements: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  isVerified: boolean;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedVersionQuizVersionId: string | null;
  publishedVersionVersionNumber: number | null;
  publishedVersionStatus: QuizVersionStatus | null;
  publishedVersionDifficulty: QuizDifficulty | null;
  publishedVersionDurationMs: number | null;
  publishedVersionPassingScorePercent: number | null;
  publishedVersionRewardXp: number | null;
  publishedVersionCreatedByUserId: string | null;
  publishedVersionCreatedAt: string | null;
  publishedVersionPublishedAt: string | null;
  publishedVersionArchivedAt: string | null;
  publishedVersionUpdatedAt: string | null;
};

export type QuizListFilters = {
  difficulty?: QuizDifficulty;
  categoryId?: string;
  tagId?: string;
  creatorId?: string;
};

export type FindRelatedQuizzesParams = {
  slug: string;
  limit: number;
};

export type QuizCursor = {
  createdAt: string;
  quizId: string;
};

export type CreateQuizPayload = {
  creatorId: string;
  title: string;
  slug: string;
  description: string | null;
  requirements: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  initialVersion: {
    difficulty: QuizDifficulty;
    durationMs: number;
    passingScorePercent: number;
    rewardXp: number;
  };
  categoryIds: string[];
  tagIds: string[];
  nowIso: string;
};

export type UpdateQuizPatch = {
  title?: string;
  description?: string | null;
  slug?: string;
  requirements?: string | null;
  imageUrl?: string | null;
  isFeatured?: boolean;
  isHidden?: boolean;
};

export type QuizStatsRow = {
  quizId: string;
  totalAttempts: number;
  totalPlayers: number;
  avgScorePercent: string;
  avgRating: string;
  ratingCount: number;
  bookmarkCount: number;
  completionRate: string;
  popularityScore: string;
  trendingScore: string;
  lastAttemptAt: string | null;
  lastCalculatedAt: string | null;
  updatedAt: string;
};

export interface QuizRepositoryPort {
  getActiveQuizRecordById(quizId: string): Promise<QuizRecordRow | null>;

  getQuizWithPublishedVersionById(quizId: string): Promise<QuizWithPublishedVersionRow | null>;

  getQuizWithPublishedVersionBySlug(slug: string): Promise<QuizWithPublishedVersionRow | null>;

  listQuizzes(params: {
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]>;

  findFeaturedQuizzes(limit: number): Promise<QuizWithPublishedVersionRow[]>;

  findRelatedQuizzes(params: FindRelatedQuizzesParams): Promise<QuizWithPublishedVersionRow[]>;

  getQuizStats(quizId: string): Promise<QuizStatsRow | null>;

  /**
   * @transactional
   * Creates a quiz with its initial version and category/tag links in a single atomic transaction.
   * If any step fails, the entire operation is rolled back.
   */
  createQuizWithInitialVersion(payload: CreateQuizPayload): Promise<{ quizId: string }>;

  updateQuizWithLinks(params: {
    quizId: string;
    patch: UpdateQuizPatch;
    categoryIds: string[] | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<void>;

  softDeleteQuiz(quizId: string, nowIso: string): Promise<void>;
}

export const QUIZ_REPOSITORY_PORT = Symbol('QUIZ_REPOSITORY_PORT');
