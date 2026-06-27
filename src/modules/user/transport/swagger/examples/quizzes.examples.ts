import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const USER_RECOMMENDED_QUIZZES_EXAMPLE = {
  data: [
    {
      quizId: '660e8400-e29b-41d4-a716-446655440000',
      title: 'JavaScript Fundamentals',
      slug: 'javascript-fundamentals',
      imageUrl: 'https://example.com/covers/js.png',
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_QUIZZES_EXAMPLE = {
  data: [
    {
      quizId: '660e8400-e29b-41d4-a716-446655440000',
      title: 'JavaScript Fundamentals',
      slug: 'javascript-fundamentals',
      imageUrl: 'https://example.com/covers/js.png',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiJ9',
    },
  },
} as const;
