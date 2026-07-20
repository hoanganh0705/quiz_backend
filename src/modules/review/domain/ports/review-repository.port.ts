export type ReviewRow = {
  reviewId: string;
  quizId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewDetailRow = ReviewRow & {
  username: string;
  userAvatarUrl: string | null;
  helpfulCount?: number;
};

export type ReviewDetailByIdRow = {
  reviewId: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  username: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  helpfulCount?: number;
};

export type MyReviewRow = {
  reviewId: string;
  quizId: string;
  quizTitle: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewCursor = {
  createdAt: string;
  reviewId: string;
};

// Phase 5 / Issue #11 — separate cursor type for the
// `helpful` sort. The previous shape reused the `createdAt`/
// `reviewId` cursor but ordered by `helpful_count DESC, review_id
// DESC`, which made cursor pagination unstable — the cursor
// predicate filtered rows by `createdAt` while the ORDER BY used
// `helpful_count`, so pages could skip or duplicate rows. The new
// cursor carries the same columns as the ORDER BY so the predicate
// matches the sort key.
export type ReviewHelpfulCursor = {
  helpfulCount: number;
  reviewId: string;
};

// Cursor union — `listReviewsByQuiz` accepts either based on
// the `sort` parameter. Repository callers must supply the right
// shape; the controller-layer mapper already validates that.
export type ReviewListCursor = ReviewCursor | ReviewHelpfulCursor;

export enum ReviewSort {
  HELPFUL = 'helpful',
  NEWEST = 'newest',
  HIGHEST_RATING = 'highest_rating',
  LOWEST_RATING = 'lowest_rating',
}

export type ReviewStatsRow = {
  averageRating: number;
  totalReviews: number;
  rating1: number;
  rating2: number;
  rating3: number;
  rating4: number;
  rating5: number;
};

export type ReviewDashboardRow = {
  totalReviews: number;
  averageRatingGiven: number;
  favoriteCategory: { categoryId: string; name: string } | null;
  favoriteTag: { tagId: string; name: string } | null;
  // Phase 5 / Issue #30 — `null` when the user has no reviews yet.
  lastUpdated: string | null;
};

export interface ReviewRepositoryPort {
  getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null>;

  getMyQuizReview(quizId: string, userId: string): Promise<ReviewDetailByIdRow | null>;

  getReviewById(reviewId: string): Promise<ReviewRow | null>;

  findReviewById(reviewId: string): Promise<ReviewDetailByIdRow | null>;

  listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    // Phase 5 / Issue #11 — the cursor type now depends on the
    // sort. The repository branches on `params.sort` and validates
    // the cursor shape implicitly. The controller-layer mapper
    // serializes/deserializes the right shape per sort.
    cursor?: ReviewListCursor | null;
    rating?: number;
    sort?: ReviewSort;
  }): Promise<ReviewDetailRow[]>;

  listUserReviews(params: {
    userId: string;
    limit: number;
    cursor?: ReviewCursor | null;
  }): Promise<MyReviewRow[]>;

  getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null>;

  getUserReviewDashboard(userId: string): Promise<ReviewDashboardRow>;

  /**
   * Atomically insert a helpful vote for `(reviewId, userId)` and bump
   * `quiz_reviews.helpful_count` by 1 in the same transaction.
   *
   * Idempotent at the database level: a duplicate insert is a no-op and the
   * counter is left untouched.
   *
   * Returns `true` when the vote was actually inserted (state changed),
   * `false` when the vote already existed (no state change).
   *
   * `voteId` is intentionally not returned: it has no consumer outside the
   * legacy pino log line at `review.service.ts:282`. If a future feature
   * needs it, extend this method then.
   */
  addHelpfulVote(params: { reviewId: string; userId: string; nowIso: string }): Promise<boolean>;

  /**
   * Atomically delete a helpful vote for `(reviewId, userId)` and decrement
   * `quiz_reviews.helpful_count` by 1 in the same transaction.
   *
   * Returns `true` when a row was actually deleted (state changed),
   * `false` when there was no vote to remove (no state change).
   */
  removeHelpfulVote(params: { reviewId: string; userId: string; nowIso: string }): Promise<boolean>;

  createReview(params: {
    quizId: string;
    userId: string;
    rating: number;
    comment: string | null;
    nowIso: string;
  }): Promise<ReviewRow>;

  updateReview(params: {
    reviewId: string;
    rating: number;
    // Phase 5 / Issue #24 — `comment` is an explicit
    // `{ set: string | null }` carrier so the repository can
    // distinguish "field absent in the PATCH payload" (no write)
    // from "field present and set to null" (clear the comment).
    comment?: { set: string | null };
    nowIso: string;
  }): Promise<ReviewRow>;

  /**
   * Phase 5 / Issue #17 — soft-delete a review. Returns `true`
   * when a row was updated (i.e. the review existed and was not
   * already soft-deleted), `false` otherwise.
   *
   * The previous `deleteReview(reviewId)` shape issued a hard
   * `DELETE` and triggered the FK cascade on
   * `review_helpful_votes`. Soft-delete preserves those vote
   * rows and the review row itself; the repository filters
   * every public read by `deleted_at IS NULL` so the row is
   * invisible to clients.
   */
  softDeleteReview(reviewId: string, nowIso: string): Promise<boolean>;

  /**
   * Phase 5 / Issue #39 — tx-aware soft-delete variant. The
   * admin service uses this inside the actioned-status
   * transition so the soft-delete, status UPDATE, audit row, and
   * analytics outbox event all commit atomically.
   */
  softDeleteReviewInTx(reviewId: string, nowIso: string, tx: unknown): Promise<boolean>;

  /**
   * Phase 5 / Issue #17 — slim existence check that ignores the
   * `deleted_at` filter. Used by the helpful-vote withdrawal
   * path: a user with an existing vote on a soft-deleted review
   * should still be able to withdraw it.
   */
  reviewExistsIncludingDeleted(reviewId: string): Promise<boolean>;

  /**
   * Phase 5 / Issue #39 — fetch the `quiz_id` for a review
   * (active OR soft-deleted) inside the caller's transaction.
   * Used by the admin actioned-status transition to populate
   * the analytics-refresh outbox event payload.
   */
  getQuizIdByReviewIdInTx(reviewId: string, tx: unknown): Promise<string | null>;

  hasCompletedAttempt(quizId: string, userId: string): Promise<boolean>;
}

export const REVIEW_REPOSITORY_PORT = Symbol('REVIEW_REPOSITORY_PORT');
