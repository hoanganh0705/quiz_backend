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
  lastUpdated: string;
};

export interface ReviewRepositoryPort {
  getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null>;

  getMyQuizReview(quizId: string, userId: string): Promise<ReviewDetailByIdRow | null>;

  getReviewById(reviewId: string): Promise<ReviewRow | null>;

  findReviewById(reviewId: string): Promise<ReviewDetailByIdRow | null>;

  listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: ReviewCursor | null;
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
    comment: string | null;
    nowIso: string;
  }): Promise<ReviewRow>;

  deleteReview(reviewId: string): Promise<void>;

  hasCompletedAttempt(quizId: string, userId: string): Promise<boolean>;
}

export const REVIEW_REPOSITORY_PORT = Symbol('REVIEW_REPOSITORY_PORT');
