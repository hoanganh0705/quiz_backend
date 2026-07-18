import { EXAMPLE_TIMESTAMP } from './_timestamp';

const PAGINATED_META = {
  timestamp: EXAMPLE_TIMESTAMP,
  pagination: {
    kind: 'cursor',
    limit: 20,
    hasNextPage: true,
    nextCursor:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0yMzQ0LTEyMzQxMjM0MTIzNDQifQ',
  },
} as const;

const RANKED_CATEGORY_ITEM = {
  rank: 1,
  categoryId: '660e8400-e29b-71d4-a716-446655440000',
  name: 'General Knowledge',
  slug: 'general-knowledge',
  imageUrl: 'https://example.com/images/general-knowledge.jpg',
  description: 'Test your knowledge across a wide range of topics',
  // Note: totalScore and totalAttempts are strings due to SQL SUM aggregation
  totalScore: '1250.5',
  totalAttempts: '4800',
};

const CATEGORY_ITEM = {
  categoryId: '660e8400-e29b-71d4-a716-446655440000',
  name: 'General Knowledge',
  slug: 'general-knowledge',
  description: 'Test your knowledge across a wide range of topics',
  imageUrl: 'https://example.com/images/general-knowledge.jpg',
  createdAt: '2025-01-15T08:30:00.000Z',
  updatedAt: '2025-06-01T12:00:00.000Z',
};

export const CATEGORY_DETAIL_EXAMPLE = {
  data: CATEGORY_ITEM,
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CATEGORY_LIST_EXAMPLE = {
  data: [CATEGORY_ITEM],
  meta: PAGINATED_META,
} as const;

export const CATEGORY_RANKED_LIST_EXAMPLE = {
  data: [RANKED_CATEGORY_ITEM],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

const RELATED_CATEGORY_ITEM = {
  categoryId: '770e8400-e29b-71d4-a716-446655440001',
  name: 'Science',
  slug: 'science',
  description: 'Explore the wonders of science',
  imageUrl: null,
  createdAt: '2025-02-10T09:00:00.000Z',
  updatedAt: '2025-05-20T14:00:00.000Z',
};

export const CATEGORY_RELATED_LIST_EXAMPLE = {
  data: [RELATED_CATEGORY_ITEM],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CATEGORY_ANALYTICS_EXAMPLE = {
  data: {
    categoryId: '660e8400-e29b-71d4-a716-446655440000',
    categoryName: 'General Knowledge',
    summary: {
      totalQuizzes: 12,
      activeQuizzes: 10,
      totalAttempts: 2480,
      totalPlayers: 920,
      averageScore: 78.4,
      averageRating: 4.6,
    },
    topQuizzes: [
      {
        rank: 1,
        quizId: '550e8400-e29b-71d4-a716-446655440001',
        title: 'World Geography',
        slug: 'world-geography',
        imageUrl: 'https://example.com/covers/geography.png',
        popularityScore: 87.6,
        totalAttempts: 1250,
        averageRating: 4.3,
        bookmarkCount: 95,
      },
    ],
    lastUpdated: '2026-06-05T01:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CATEGORY_FOLLOW_MESSAGE_EXAMPLE = {
  data: { message: 'Category followed successfully' },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

// Note: Following an already-followed category returns the same success message (idempotent)

export const CATEGORY_UNFOLLOW_MESSAGE_EXAMPLE = {
  data: { message: 'Category unfollowed successfully' },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CATEGORY_DELETE_MESSAGE_EXAMPLE = {
  data: { message: 'Category deleted successfully' },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CATEGORY_FOLLOWED_LIST_EXAMPLE = {
  data: [
    {
      categoryId: '660e8400-e29b-71d4-a716-446655440000',
      name: 'General Knowledge',
      slug: 'general-knowledge',
      imageUrl: 'https://example.com/images/general-knowledge.jpg',
      description: 'Test your knowledge across a wide range of topics',
      followedAt: '2025-06-05T14:30:00.000Z',
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

export const CATEGORY_QUIZZES_EXAMPLE = {
  data: [
    {
      quizId: '550e8400-e29b-71d4-a716-446655440001',
      title: 'World Geography',
      slug: 'world-geography',
      imageUrl: 'https://example.com/covers/geography.png',
    },
  ],
  meta: PAGINATED_META,
} as const;
