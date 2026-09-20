export const REVIEW_THROTTLE_VALUES = {
  createReview: { limit: 10, ttl: 60_000 },
  updateReview: { limit: 10, ttl: 60_000 },
  deleteReview: { limit: 5, ttl: 60_000 },
  markReviewHelpful: { limit: 30, ttl: 60_000 },
  removeHelpfulVote: { limit: 30, ttl: 60_000 },
  reportReview: { limit: 5, ttl: 60_000 },
  listReviews: { limit: 60, ttl: 60_000 },
  getQuizReviewStats: { limit: 60, ttl: 60_000 },
  getCreatorQuizReviewAnalytics: { limit: 60, ttl: 60_000 },
  listUserReviews: { limit: 60, ttl: 60_000 },
  listReviewsByUser: { limit: 60, ttl: 60_000 },
  getMyQuizReview: { limit: 60, ttl: 60_000 },
  listMyReviews: { limit: 60, ttl: 60_000 },
  listMyReportedReviews: { limit: 60, ttl: 60_000 },
  getMyReviewDashboard: { limit: 30, ttl: 60_000 },
  getReviewById: { limit: 120, ttl: 60_000 },
  listPlatformReports: { limit: 60, ttl: 60_000 },
  updateReportStatus: { limit: 30, ttl: 60_000 },
  adminDeleteReview: { limit: 10, ttl: 60_000 },
} as const;

export type ReviewThrottleConfig = typeof REVIEW_THROTTLE_VALUES;
