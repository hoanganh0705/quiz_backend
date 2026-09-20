import type { QuizDifficulty, QuizVersionStatus } from '../../types/quiz.types';

export type QuizRecordRow = {
  quizId: string;
  creatorId: string | null;
  isHidden: boolean;
  publishedVersionId: string | null;
};

export type QuizTagRow = {
  tagId: string;
  name: string;
  slug: string;
};

export type AuthorSummaryRow = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarPublicId: string | null;
};

export type CategorySummaryRow = {
  categoryId: string;
  name: string;
  slug: string;
};

export type QuizAggregatesRow = {
  quizId: string;
  averageRating: number;
  reviewCount: number;
  attemptCount: number;
};

export type VersionQuestionCountRow = {
  quizVersionId: string;
  questionCount: number;
};

export type QuizWithPublishedVersionRow = {
  quizId: string;
  creatorId: string | null;
  title: string;
  description: string | null;
  slug: string;
  requirements: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  categoryId: string | null;
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
  tagIds?: string[];
  creatorId?: string;
  q?: string;
  sort?: 'newest' | 'popular' | 'top_rated' | 'trending';
  isHidden?: boolean;
  minRating?: number;
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
  imagePublicId: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  initialVersion: {
    difficulty: QuizDifficulty;
    durationMs: number;
    passingScorePercent: number;
    rewardXp: number;
  };
  categoryId: string | null;
  tagIds: string[];
  nowIso: string;
};

export type UpdateQuizPatch = {
  title?: string;
  description?: string | null;
  slug?: string;
  requirements?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
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

  getTagsForQuiz(quizId: string): Promise<QuizTagRow[]>;

  getTagsForQuizIds(quizIds: string[]): Promise<Map<string, QuizTagRow[]>>;

  getAuthorSummaries(userIds: string[]): Promise<Map<string, AuthorSummaryRow>>;

  getCategorySummaries(categoryIds: string[]): Promise<Map<string, CategorySummaryRow>>;

  getAggregatesForQuizzes(quizIds: string[]): Promise<Map<string, QuizAggregatesRow>>;

  getQuestionCountsForVersionIds(versionIds: string[]): Promise<Map<string, number>>;

  listQuizzes(params: {
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]>;

  listByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]>;

  listDraftsByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]>;

  listPublishedByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
    filters?: QuizListFilters;
  }): Promise<QuizWithPublishedVersionRow[]>;

  findFeaturedQuizzes(limit: number): Promise<QuizWithPublishedVersionRow[]>;

  findRelatedQuizzes(params: FindRelatedQuizzesParams): Promise<QuizWithPublishedVersionRow[]>;

  getQuizStats(quizId: string): Promise<QuizStatsRow | null>;

  createQuizWithInitialVersion(payload: CreateQuizPayload): Promise<{
    row: QuizWithPublishedVersionRow;
    tags: QuizTagRow[];
  }>;

  updateQuizWithLinks(params: {
    quizId: string;
    patch: UpdateQuizPatch;
    categoryId: string | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<{
    row: QuizWithPublishedVersionRow;
    tags: QuizTagRow[];
  } | null>;

  softDeleteQuiz(quizId: string, nowIso: string): Promise<void>;

  findQuizCoverPublicIdById(quizId: string): Promise<string | null>;
}

export const QUIZ_REPOSITORY_PORT = Symbol('QUIZ_REPOSITORY_PORT');
