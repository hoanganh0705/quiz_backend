import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const USER_BADGES_EXAMPLE = {
  data: [
    {
      badgeId: 'b9d6f3a0-7d6e-7d6c-b4d2-1a4f6b2aef90',
      name: 'Quiz Master',
      description: 'Earned by completing 100 quizzes with a score above 90%.',
      earnedAt: '2026-05-12T14:18:00.000Z',
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

export const USER_ACTIVITY_EXAMPLE = {
  data: [
    {
      eventId: '7c9e6679-7425-70de-944b-e07fc1f90ae7',
      eventType: 'attempt_completed',
      createdAt: '2026-06-25T10:30:00.000Z',
      metadata: { quizId: '660e8400-e29b-71d4-a716-446655440000', score: 88 },
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiIsImV2ZW50SWQiOiJ1dWlkIn0',
    },
  },
} as const;
