import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const TAG_RANKED_LIST_EXAMPLE = {
  data: [
    {
      rank: 1,
      tagId: '770e8400-e29b-71d4-a716-446655440000',
      name: 'JavaScript',
      slug: 'javascript',
      totalScore: '980.5',
      totalAttempts: '4200',
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_RELATED_LIST_EXAMPLE = {
  data: [
    {
      tagId: '770e8400-e29b-71d4-a716-446655440000',
      name: 'JavaScript',
      slug: 'javascript',
      createdAt: '2025-01-15T08:30:00.000Z',
      updatedAt: '2025-06-01T12:00:00.000Z',
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_ANALYTICS_EXAMPLE = {
  data: {
    tagId: '770e8400-e29b-71d4-a716-446655440000',
    tagName: 'JavaScript',
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
        quizId: '660e8400-e29b-71d4-a716-446655440000',
        title: 'JavaScript Fundamentals',
        slug: 'javascript-fundamentals',
        imageUrl: 'https://example.com/covers/js.png',
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

export const TAG_FOLLOWED_LIST_EXAMPLE = {
  data: [
    {
      tagId: '770e8400-e29b-71d4-a716-446655440000',
      name: 'JavaScript',
      slug: 'javascript',
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

export const TAG_DELETE_MESSAGE_EXAMPLE = {
  data: {
    message: 'Tag deleted successfully',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_CREATED_EXAMPLE = {
  data: {
    tagId: '770e8400-e29b-71d4-a716-446655440000',
    name: 'Algorithms',
    slug: 'algorithms',
    createdAt: '2026-07-14T00:42:19.472Z',
    updatedAt: '2026-07-14T00:42:19.472Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_UPDATED_EXAMPLE = {
  data: {
    tagId: '770e8400-e29b-71d4-a716-446655440000',
    name: 'Algorithms (renamed)',
    slug: 'algorithms',
    createdAt: '2026-07-14T00:42:19.472Z',
    updatedAt: '2026-07-15T01:15:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_RESTORED_EXAMPLE = {
  data: {
    tagId: '770e8400-e29b-71d4-a716-446655440000',
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2026-07-15T01:15:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
