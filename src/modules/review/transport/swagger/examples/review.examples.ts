import { EXAMPLE_TIMESTAMP } from './_timestamp';

/**
 * Review module success-response examples.
 *
 * Each constant is named `<endpoint>Example` and matches the runtime
 * envelope shape produced by `ReviewPresenter`. Examples are referenced by
 * `review-swagger-decorators.ts`.
 *
 * The DTO contract is documented in `src/modules/review/dto/response/`;
 * the JSON values below mirror those DTOs exactly so OpenAPI consumers can
 * see the wire format without leaving the docs.
 */

// ─── GET /reviews/me ──────────────────────────────────────────────────────

export const REVIEW_DASHBOARD_EXAMPLE = {
  data: {
    totalReviews: 85,
    averageRatingGiven: 4.2,
    favoriteCategory: {
      categoryId: '770e8400-e29b-71d4-a716-446655440001',
      name: 'Science',
    },
    favoriteTag: {
      tagId: '880e8400-e29b-71d4-a716-446655440002',
      name: 'Biology',
    },
    lastUpdated: '2026-07-15T08:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /quizzes/:quizId/reviews ──────────────────────────────────────

export const REVIEW_CREATED_EXAMPLE = {
  data: {
    reviewId: '550e8400-e29b-71d4-a716-446655440099',
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    rating: 4,
    comment: 'Great quiz! Some questions were tricky but fair.',
    createdAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /quizzes/:quizId/reviews ───────────────────────────────────────

export const REVIEW_LIST_EXAMPLE = {
  data: [
    {
      reviewId: '550e8400-e29b-71d4-a716-446655440099',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      userId: '550e8400-e29b-71d4-a716-446655440001',
      username: 'alice_wonder',
      userAvatarUrl: 'https://example.com/avatars/alice.png',
      rating: 5,
      comment: 'Excellent quiz! Very well structured.',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
      helpfulCount: 42,
    },
    {
      reviewId: '550e8400-e29b-71d4-a716-446655440098',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      userId: '550e8400-e29b-71d4-a716-446655440002',
      username: 'bob_builder',
      userAvatarUrl: null,
      rating: 4,
      comment: 'Good quiz overall.',
      createdAt: '2026-06-28T10:30:00.000Z',
      updatedAt: '2026-06-28T10:30:00.000Z',
      helpfulCount: 15,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiAiMjAyNi0wNi0yOFQxMDozMDowMC4wMDBaIiwgInJldmlld0lkIjogIjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OCJ9',
    },
  },
} as const;

export const REVIEW_LIST_EMPTY_EXAMPLE = {
  data: [],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /quizzes/:quizId/reviews/stats ──────────────────────────────────

export const REVIEW_STATS_EXAMPLE = {
  data: {
    averageRating: 4.3,
    totalReviews: 1250,
    ratingDistribution: {
      '1': 12,
      '2': 20,
      '3': 55,
      '4': 300,
      '5': 863,
    },
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /quizzes/:quizId/reviews/analytics ─────────────────────────────
// Note: This returns QuizAnalyticsResponseDto from the quiz module.
export const REVIEW_ANALYTICS_EXAMPLE = {
  data: {
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    metrics: {
      totalAttempts: 1250,
      uniquePlayers: 820,
      averageScore: 72.4,
      completionRate: 0.85,
    },
    reviewMetrics: {
      averageRating: 4.3,
      ratingCount: 312,
    },
    engagementMetrics: {
      bookmarkCount: 95,
    },
    popularity: {
      popularityScore: 87.6,
      trendingScore: 45.2,
      rank: 12,
    },
    lastUpdated: '2026-07-13T09:11:05.026Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /quizzes/:quizId/reviews/me ────────────────────────────────────

export const REVIEW_MY_FOR_QUIZ_EXAMPLE = {
  data: {
    reviewId: '550e8400-e29b-71d4-a716-446655440099',
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    quizTitle: 'JavaScript Fundamentals',
    userId: '550e8400-e29b-71d4-a716-446655440001',
    username: 'alice_wonder',
    rating: 4,
    comment: 'Great quiz! Some questions were tricky but fair.',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    helpfulCount: 5,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const REVIEW_MY_FOR_QUIZ_NULL_EXAMPLE = {
  data: null,
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── PATCH /quizzes/:quizId/reviews ──────────────────────────────────────

export const REVIEW_UPDATED_EXAMPLE = {
  data: {
    reviewId: '550e8400-e29b-71d4-a716-446655440099',
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    rating: 5,
    comment: 'Updated my review after retaking the quiz.',
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── DELETE /quizzes/:quizId/reviews ──────────────────────────────────────

export const REVIEW_DELETED_EXAMPLE = {
  data: {
    message: 'Review deleted successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /reviews/:reviewId/helpful ────────────────────────────────────

export const REVIEW_HELPFUL_EXAMPLE = {
  data: {
    message: 'Review marked as helpful',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── DELETE /reviews/:reviewId/helpful ──────────────────────────────────

export const REVIEW_HELPFUL_REMOVED_EXAMPLE = {
  data: {
    message: 'Helpful vote removed',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── POST /reviews/:reviewId/report ─────────────────────────────────────

export const REVIEW_REPORTED_EXAMPLE = {
  data: {
    message: 'Review reported successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /reviews/:reviewId ──────────────────────────────────────────────

export const REVIEW_DETAIL_EXAMPLE = {
  data: {
    reviewId: '550e8400-e29b-71d4-a716-446655440099',
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    quizTitle: 'JavaScript Fundamentals',
    userId: '550e8400-e29b-71d4-a716-446655440001',
    username: 'alice_wonder',
    rating: 4,
    comment: 'Great quiz! Some questions were tricky but fair.',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    helpfulCount: 42,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /users/me/reviews ────────────────────────────────────────────────

export const MY_REVIEWS_LIST_EXAMPLE = {
  data: [
    {
      reviewId: '550e8400-e29b-71d4-a716-446655440099',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      quizTitle: 'JavaScript Fundamentals',
      rating: 5,
      comment: 'Excellent quiz! Very well structured.',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
    {
      reviewId: '550e8400-e29b-71d4-a716-446655440098',
      quizId: '660e8400-e29b-71d4-a716-446655440001',
      quizTitle: 'Python Basics',
      rating: 4,
      comment: 'Good introduction to Python.',
      createdAt: '2026-06-15T09:00:00.000Z',
      updatedAt: null,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /users/me/reported-reviews ───────────────────────────────────────

export const REPORTED_REVIEWS_LIST_EXAMPLE = {
  data: [
    {
      reportId: '990e8400-e29b-71d4-a716-446655440001',
      reviewId: '550e8400-e29b-71d4-a716-446655440099',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      quizTitle: 'JavaScript Fundamentals',
      reviewerUsername: 'bad_actor',
      rating: 1,
      comment: 'This is spam content.',
      reason: 'spam',
      details: 'Contains advertising links',
      status: 'open',
      createdAt: '2026-07-10T14:00:00.000Z',
      updatedAt: null,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /users/me/reviews/:quizId ────────────────────────────────────────

export const MY_REVIEW_FOR_QUIZ_EXAMPLE = {
  data: {
    reviewId: '550e8400-e29b-71d4-a716-446655440099',
    quizId: '660e8400-e29b-71d4-a716-446655440000',
    quizTitle: 'JavaScript Fundamentals',
    userId: '550e8400-e29b-71d4-a716-446655440001',
    username: 'alice_wonder',
    rating: 4,
    comment: 'Great quiz! Some questions were tricky but fair.',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    helpfulCount: 5,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// ─── GET /users/:userId/reviews ──────────────────────────────────────────

export const USER_REVIEWS_LIST_EXAMPLE = {
  data: [
    {
      reviewId: '550e8400-e29b-71d4-a716-446655440099',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      quizTitle: 'JavaScript Fundamentals',
      rating: 5,
      comment: 'Excellent quiz! Very well structured.',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 10,
      hasNextPage: false,
      nextCursor: null,
    },
  },
} as const;

// ─── GET /admin/reviews/reports ──────────────────────────────────────────

export const ADMIN_REPORTS_LIST_EXAMPLE = {
  data: [
    {
      reportId: '990e8400-e29b-71d4-a716-446655440001',
      reviewId: '550e8400-e29b-71d4-a716-446655440099',
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      quizTitle: 'JavaScript Fundamentals',
      reviewerUsername: 'bad_actor',
      reportedUserId: '550e8400-e29b-71d4-a716-446655440099',
      rating: 1,
      comment: 'Spam content with advertising links.',
      reason: 'spam',
      details: 'Contains advertising links',
      status: 'open',
      createdAt: '2026-07-10T14:00:00.000Z',
      updatedAt: null,
    },
    {
      reportId: '990e8400-e29b-71d4-a716-446655440002',
      reviewId: '550e8400-e29b-71d4-a716-446655440098',
      quizId: '660e8400-e29b-71d4-a716-446655440001',
      quizTitle: 'Python Basics',
      reviewerUsername: 'annoying_user',
      reportedUserId: '550e8400-e29b-71d4-a716-446655440098',
      rating: 1,
      comment: 'Inappropriate content.',
      reason: 'harassment',
      details: null,
      status: 'reviewed',
      createdAt: '2026-07-09T10:00:00.000Z',
      updatedAt: '2026-07-11T08:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiAiMjAyNi0wNy0wOVQxMDowMDowMC4wMDBaIiwgInJlcG9ydElkIjogIjk5MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMiJ9',
    },
  },
} as const;

// ─── PATCH /admin/reviews/reports/:reportId ───────────────────────────────

export const ADMIN_REPORT_UPDATED_EXAMPLE = {
  data: {
    message: 'Report status updated successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
