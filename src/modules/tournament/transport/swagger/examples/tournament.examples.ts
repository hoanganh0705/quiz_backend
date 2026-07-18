import { EXAMPLE_TIMESTAMP } from './_timestamp';

// ===========================================================================
// Tournament Response Examples
// ===========================================================================

export const TOURNAMENT_DETAIL_EXAMPLE = {
  data: {
    tournamentId: '660e8400-e29b-71d4-a716-446655440000',
    title: 'Weekly Trivia Challenge',
    description: 'Test your knowledge across various topics every week.',
    difficulty: 'medium',
    status: 'registration',
    prize: '500 XP and exclusive badge',
    startAt: '2026-07-20T10:00:00.000Z',
    endAt: '2026-07-20T12:00:00.000Z',
    maxParticipants: 100,
    categoryId: '770e8400-e29b-71d4-a716-446655440001',
    categoryName: 'General Knowledge',
    categorySlug: 'general-knowledge',
    totalParticipants: 47,
    rounds: [
      {
        roundId: '880e8400-e29b-71d4-a716-446655440001',
        tournamentId: '660e8400-e29b-71d4-a716-446655440000',
        roundNumber: 1,
        name: 'Quarter Finals',
        description: 'First round of the weekly challenge.',
        quizVersionId: '990e8400-e29b-71d4-a716-446655440001',
        startAt: '2026-07-20T10:00:00.000Z',
        endAt: '2026-07-20T11:00:00.000Z',
        durationMs: 3600000,
        status: 'pending',
        isElimination: false,
        participantLimit: null,
        createdAt: '2026-07-01T12:00:00.000Z',
        updatedAt: '2026-07-01T12:00:00.000Z',
      },
    ],
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-15T08:30:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TOURNAMENT_LIST_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-71d4-a716-446655440000',
      title: 'Weekly Trivia Challenge',
      description: 'Test your knowledge across various topics every week.',
      difficulty: 'medium',
      status: 'registration',
      prize: '500 XP and exclusive badge',
      startAt: '2026-07-20T10:00:00.000Z',
      endAt: '2026-07-20T12:00:00.000Z',
      maxParticipants: 100,
      categoryId: '770e8400-e29b-71d4-a716-446655440001',
      createdAt: '2026-07-01T12:00:00.000Z',
      updatedAt: '2026-07-15T08:30:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJjcmVhdGVkQXQiOiIyMDI2LTA3LTAxVDEyOjAwOjAwLjAwMFoiLCJ0b3VybmFtZW50SWQiOiI2NjBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ',
    },
  },
} as const;

export const UPCOMING_TOURNAMENTS_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-71d4-a716-446655440001',
      name: 'Summer Quiz Championship',
      description: 'Annual summer championship with amazing prizes.',
      startAt: '2026-08-01T09:00:00.000Z',
      endAt: '2026-08-01T11:00:00.000Z',
      participantCount: 234,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 15,
      hasMore: true,
    },
  },
} as const;

export const ACTIVE_TOURNAMENTS_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-71d4-a716-446655440002',
      name: 'Weekly Trivia Challenge',
      startAt: '2026-07-16T10:00:00.000Z',
      endAt: '2026-07-16T12:00:00.000Z',
      participantCount: 523,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 8,
      hasMore: false,
    },
  },
} as const;

export const COMPLETED_TOURNAMENTS_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-71d4-a716-446655440003',
      name: 'Last Week Challenge',
      startAt: '2026-07-09T10:00:00.000Z',
      endAt: '2026-07-09T12:00:00.000Z',
      participantCount: 487,
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 52,
      hasMore: true,
    },
  },
} as const;

export const RELATED_TOURNAMENTS_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-71d4-a716-446655440004',
      name: 'Backend Challenge',
      startAt: '2026-07-25T14:00:00.000Z',
      participantCount: 312,
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TOURNAMENT_LEADERBOARD_EXAMPLE = {
  data: [
    {
      rank: 1,
      participantId: '550e8400-e29b-71d4-a716-446655440001',
      userId: '550e8400-e29b-71d4-a716-446655440000',
      username: 'alice_wonder',
      displayName: 'Alice Wonder',
      avatarUrl: 'https://example.com/avatars/alice.png',
      totalScore: 8500,
      totalTimeMs: 3600000,
      rankFinal: null,
      status: 'active',
    },
    {
      rank: 2,
      participantId: '550e8400-e29b-71d4-a716-446655440002',
      userId: '550e8400-e29b-71d4-a716-446655440001',
      username: 'bob_builder',
      displayName: null,
      avatarUrl: null,
      totalScore: 8200,
      totalTimeMs: 3650000,
      rankFinal: null,
      status: 'active',
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TOURNAMENT_WINNERS_EXAMPLE = {
  data: [
    {
      rank: 1,
      userId: '550e8400-e29b-71d4-a716-446655440000',
      username: 'alice_wonder',
      score: 9800,
      avatarUrl: 'https://example.com/avatars/alice.png',
    },
    {
      rank: 2,
      userId: '550e8400-e29b-71d4-a716-446655440001',
      username: 'bob_builder',
      score: 9500,
      avatarUrl: null,
    },
    {
      rank: 3,
      userId: '550e8400-e29b-71d4-a716-446655440002',
      username: 'charlie_chef',
      score: 9200,
      avatarUrl: 'https://example.com/avatars/charlie.png',
    },
  ],
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const TOURNAMENT_STATS_EXAMPLE = {
  data: {
    tournamentId: '660e8400-e29b-71d4-a716-446655440000',
    participants: 523,
    completedParticipants: 410,
    averageScore: 72,
    highestScore: 100,
    lowestScore: 12,
    completionRate: 78.39,
    averageRank: 262,
    startedAt: '2026-07-16T10:00:00.000Z',
    endedAt: '2026-07-16T12:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const MY_STANDING_EXAMPLE = {
  data: {
    rank: 23,
    score: 5420,
    percentile: 95,
    participantCount: 523,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const PARTICIPANTS_EXAMPLE = {
  data: [
    {
      userId: '550e8400-e29b-71d4-a716-446655440000',
      username: 'alice_wonder',
      registeredAt: '2026-07-15T08:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 523,
      hasMore: true,
    },
  },
} as const;

export const REGISTER_SUCCESS_EXAMPLE = {
  data: {
    participantId: '550e8400-e29b-71d4-a716-446655440099',
    tournamentId: '660e8400-e29b-71d4-a716-446655440000',
    userId: '550e8400-e29b-71d4-a716-446655440000',
    registeredAt: '2026-07-16T10:30:00.000Z',
    message: 'Successfully registered for the tournament',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const START_ATTEMPT_SUCCESS_EXAMPLE = {
  data: {
    attemptId: '330e8400-e29b-71d4-a716-446655440099',
    quizVersionId: '990e8400-e29b-71d4-a716-446655440001',
    participantId: '550e8400-e29b-71d4-a716-446655440099',
    message: 'Attempt started successfully. Use the attempt endpoint to continue.',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const UNREGISTER_SUCCESS_EXAMPLE = {
  data: {
    message: 'Successfully unregistered from the tournament',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const WITHDRAW_SUCCESS_EXAMPLE = {
  data: {
    success: true,
    tournamentId: '660e8400-e29b-71d4-a716-446655440000',
    status: 'withdrawn',
    withdrawnAt: '2026-07-16T11:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const CREATE_TOURNAMENT_EXAMPLE = {
  data: {
    tournamentId: '660e8400-e29b-71d4-a716-446655440099',
    title: 'Weekly Trivia Challenge',
    description: 'Test your knowledge across various topics every week.',
    difficulty: 'medium',
    status: 'upcoming',
    prize: '500 XP and exclusive badge',
    startAt: '2026-07-20T10:00:00.000Z',
    endAt: '2026-07-20T12:00:00.000Z',
    maxParticipants: 100,
    categoryId: '770e8400-e29b-71d4-a716-446655440001',
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;
