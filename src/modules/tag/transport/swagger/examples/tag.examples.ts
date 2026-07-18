import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const TAG_DETAIL_EXAMPLE = {
  data: {
    tagId: '770e8400-e29b-71d4-a716-446655440000',
    name: 'JavaScript',
    slug: 'javascript',
    createdAt: '2025-01-15T08:30:00.000Z',
    updatedAt: '2025-06-01T12:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TAG_LIST_EXAMPLE = {
  data: [
    {
      tagId: '770e8400-e29b-71d4-a716-446655440000',
      name: 'JavaScript',
      slug: 'javascript',
      createdAt: '2025-01-15T08:30:00.000Z',
      updatedAt: '2025-06-01T12:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    },
  },
} as const;

export const TAG_QUIZZES_EXAMPLE = {
  data: [
    {
      quizId: '660e8400-e29b-71d4-a716-446655440000',
      title: 'JavaScript Fundamentals',
      slug: 'javascript-fundamentals',
      imageUrl: 'https://example.com/covers/js.png',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    },
  },
} as const;
