import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const USER_RANKING_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    globalRank: 42,
    totalScore: 15420,
    level: 14,
    updatedAt: '2026-06-25T10:30:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_ANALYTICS_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    summary: { totalAttempts: 420, completedQuizzes: 310, averageScore: 83.5 },
    favoriteCategory: {
      categoryId: '660e8400-e29b-41d4-a716-446655440000',
      name: 'Science',
    },
    favoriteTag: {
      tagId: '770e8400-e29b-41d4-a716-446655440111',
      name: 'Physics',
    },
    lastUpdated: '2026-06-05T01:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_CREATOR_QUIZ_ANALYTICS_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    totalQuizzes: 12,
    draftQuizzes: 3,
    publishedQuizzes: 9,
    totalAttempts: 4800,
    totalPlayers: 2900,
    averageScore: 76.4,
    averageRating: 4.4,
    totalBookmarks: 510,
    totalReviews: 310,
    lastUpdated: '2026-06-01T00:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
