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
};

export type ReviewCursor = {
  createdAt: string;
  reviewId: string;
};

export interface ReviewRepositoryPort {
  getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null>;

  getReviewById(reviewId: string): Promise<ReviewRow | null>;

  listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: ReviewCursor | null;
  }): Promise<ReviewDetailRow[]>;

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

  getPublishedQuizVersionDifficulty(quizId: string): Promise<string | null>;
}

export const REVIEW_REPOSITORY_PORT = Symbol('REVIEW_REPOSITORY_PORT');
