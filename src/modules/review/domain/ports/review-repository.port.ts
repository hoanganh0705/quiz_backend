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
  content: string | null;
  createdAt: string;
  updatedAt: string;
  helpfulCount?: number;
};

export type MyReviewRow = {
  reviewId: string;
  quizId: string;
  quizTitle: string;
  rating: number;
  content: string | null;
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

export type ReportCursor = {
  createdAt: string;
  reportId: string;
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

export type ReportedReviewRow = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  rating: number;
  content: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export type PlatformReportRow = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  content: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export interface ReviewRepositoryPort {
  getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null>;

  getMyQuizReview(
    quizId: string,
    userId: string,
  ): Promise<import('@/modules/review/domain/ports').ReviewDetailByIdRow | null>;

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

  markReviewHelpful(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<ReviewHelpfulVoteRow>;

  hasUserReportedReview(reviewId: string, reporterId: string): Promise<boolean>;

  listReportedReviews(params: {
    reporterId: string;
    limit: number;
    cursor?: ReportCursor | null;
  }): Promise<ReportedReviewRow[]>;

  createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow>;

  removeReviewHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<void>;

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

  updateHelpfulCount(reviewId: string, increment: number): Promise<void>;

  hasCompletedAttempt(quizId: string, userId: string): Promise<boolean>;

  listPlatformReports(params: {
    limit: number;
    cursor?: { createdAt: string; reportId: string } | null;
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
  }): Promise<PlatformReportRow[]>;

  updateReportStatus(params: {
    reportId: string;
    status: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
  }): Promise<void>;
}

export const REVIEW_REPOSITORY_PORT = Symbol('REVIEW_REPOSITORY_PORT');
