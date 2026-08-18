import type { QuizDifficulty, QuizVersionStatus } from '../../types/quiz.types';

export type QuizRecordRow = {
  quizId: string;
  creatorId: string | null;
  /**
   * Whether the quiz is hidden from public listings.
   *
   * Surfaced on `getActiveQuizRecordById` so callers (e.g. review
   * gating, analytics) can apply the visibility predicate without
   * making a second round-trip.
   *
   * Phase 1 / Issue #25 — public review-stats endpoint must refuse
   * hidden quizzes so that quiz owners do not leak rating data on
   * an unpublished asset.
   *
   * Phase 1 / Issue #1 — review creation also requires the quiz to
   * be visible, since hidden assets are off-limits to user input.
   */
  isHidden: boolean;
  /**
   * The id of the currently published version, if any.
   *
   * A quiz without a published version is a draft and must not be
   * publicly reviewable. Used by both Issue #1 and #25.
   */
  publishedVersionId: string | null;
};

export type QuizTagRow = {
  tagId: string;
  name: string;
  slug: string;
};

/**
 * Phase 2 (S-6): batched creator-summary projection. Sourced from a
 * single `users` + `user_profiles` LEFT JOIN keyed by the quiz's
 * `creator_id`. The mapper projects this into the wire-side
 * `AuthorSummaryDto` (slim — no email, no settings, no bio).
 */
export type AuthorSummaryRow = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarPublicId: string | null;
};

/**
 * Phase 2 (S-6): batched category projection for the
 * `categoryName` / `categorySlug` join on the list projection.
 * Soft-deleted categories are filtered out at the query layer so
 * a quiz whose category was deleted does not surface a dangling
 * name in client-side rendering — both fields read as `null` and
 * the card renders the placeholder "Uncategorized".
 */
export type CategorySummaryRow = {
  categoryId: string;
  name: string;
  slug: string;
};

/**
 * Phase 2 (S-6): aggregated stats row for a quiz. Joins onto the
 * existing `quiz_stats` materialised view (see
 * `docs/plans/denormalized-counters-audit.md`). The list endpoint
 * uses these to populate `averageRating` / `reviewCount` /
 * `attemptCount` without per-row aggregation in SQL.
 */
export type QuizAggregatesRow = {
  quizId: string;
  averageRating: number;
  reviewCount: number;
  attemptCount: number;
};

/**
 * Phase 2 (S-8): per-version question count. Aggregated from
 * `quiz_questions.quiz_version_id` once and indexed by
 * `quizVersionId` so the mapper can attach it without round-trips.
 */
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

/**
 * Phase 2 (S-12) extended `QuizListFilters` with the new query
 * dimensions. The repository picks up the new filters and the
 * application service translates the request DTO into this shape.
 */
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

  /**
   * Phase 2 (S-6): batched tag projection keyed by `quizId`. The
   * list endpoint uses this to populate `QuizListItemDto.tags`
   * without an N+1 round-trip — one SQL query per page, not one
   * per quiz. Tags are returned ordered by `tags.name` so the
   * client renders a stable chip order across pages.
   */
  getTagsForQuizIds(quizIds: string[]): Promise<Map<string, QuizTagRow[]>>;

  /**
   * Phase 2 (S-6): batched creator summary keyed by userId. The
   * list endpoint passes the distinct `creatorId`s from the page
   * and stitches the result into the `creator` field. Soft-deleted
   * users are filtered out at the query layer so their avatars do
   * not appear on quiz cards.
   */
  getAuthorSummaries(userIds: string[]): Promise<Map<string, AuthorSummaryRow>>;

  /**
   * Phase 2 (S-6): batched category summary keyed by `categoryId`.
   * Same JOIN-and-batch pattern as creator / tags — single query
   * per page, not per quiz.
   */
  getCategorySummaries(categoryIds: string[]): Promise<Map<string, CategorySummaryRow>>;

  /**
   * Phase 2 (S-6 + S-8): batched aggregates for the list projection.
   * Returns the denormalised `quiz_stats` rows joined to the input
   * `quizIds`. Quizzes without a stats row (very fresh, never
   * recomputed) are absent from the result map — callers must
   * treat absence as "default values (0, 0, 0)".
   */
  getAggregatesForQuizzes(quizIds: string[]): Promise<Map<string, QuizAggregatesRow>>;

  /**
   * Phase 2 (S-8): per-version question count. Aggregated from
   * `quiz_questions.quiz_version_id` once per page. Returned
   * keyed by `quizVersionId` so the mapper can attach to the
   * `publishedVersion` block directly.
   */
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
  }): Promise<QuizWithPublishedVersionRow[]>;

  listDraftsByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
  }): Promise<QuizWithPublishedVersionRow[]>;

  listPublishedByCreatorId(params: {
    creatorId: string;
    limit: number;
    cursor?: QuizCursor | null;
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
    categoryId: string | null;
    tagIds: string[] | null;
    nowIso: string;
  }): Promise<void>;

  softDeleteQuiz(quizId: string, nowIso: string): Promise<void>;

  /**
   * Phase 6: read the current cover `publicId` for a quiz. Used by
   * `StorageImageLifecycleService` to discover the previous
   * Cloudinary asset before performing a best-effort delete on
   * replace / remove / quiz-delete. Returns `null` when the quiz
   * has no cover image or the quiz does not exist.
   */
  findQuizCoverPublicIdById(quizId: string): Promise<string | null>;
}

export const QUIZ_REPOSITORY_PORT = Symbol('QUIZ_REPOSITORY_PORT');
