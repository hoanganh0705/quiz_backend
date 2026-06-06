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

export type ReviewDetailByIdRow = {
  reviewId: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  username: string;
  rating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyReviewRow = {
  reviewId: string;
  quizId: string;
  quizTitle: string;
  rating: number;
  content: string | null;
  createdAt: string;
};

export type ReviewCursor = {
  createdAt: string;
  reviewId: string;
};

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

export type ReviewHelpfulVoteRow = {
  voteId: string;
  reviewId: string;
  userId: string;
  createdAt: string;
};

export type ReviewReportRow = {
  reportId: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export interface ReviewRepositoryPort {
  getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null>;

  getReviewById(reviewId: string): Promise<ReviewRow | null>;

  findReviewById(reviewId: string): Promise<ReviewDetailByIdRow | null>;

  listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: ReviewCursor | null;
    rating?: number;
  }): Promise<ReviewDetailRow[]>;

  listUserReviews(params: {
    userId: string;
    limit: number;
    cursor?: ReviewCursor | null;
  }): Promise<MyReviewRow[]>;

  listReviewsByUser(params: {
    userId: string;
    limit: number;
    cursor?: ReviewCursor | null;
  }): Promise<MyReviewRow[]>;

  getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null>;

  getUserReviewDashboard(userId: string): Promise<ReviewDashboardRow>;

  markReviewHelpful(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<ReviewHelpfulVoteRow>;

  hasUserReportedReview(reviewId: string, reporterId: string): Promise<boolean>;

  createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow>;

  removeReviewHelpfulVote(params: { reviewId: string; userId: string; nowIso: string }): Promise<void>;

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
