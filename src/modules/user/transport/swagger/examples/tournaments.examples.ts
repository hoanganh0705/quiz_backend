import { EXAMPLE_TIMESTAMP } from './_timestamp';

export const USER_TOURNAMENT_PROFILE_EXAMPLE = {
  data: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    tournamentsPlayed: 32,
    tournamentsWon: 4,
    bestRank: 1,
    averageRank: 18,
    top10Finishes: 12,
    totalTournamentScore: 15420,
    lastTournamentAt: '2026-06-01T00:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_TOURNAMENT_HISTORY_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-41d4-a716-446655440000',
      tournamentName: 'Spring Challenge',
      rank: 12,
      score: 540,
      participantCount: 523,
      completedAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: { limit: 20, hasNextPage: false, nextCursor: null },
  },
} as const;

export const USER_TOURNAMENT_ANALYTICS_EXAMPLE = {
  data: {
    tournamentsPlayed: 45,
    wins: 6,
    top3Finishes: 11,
    top10Finishes: 18,
    averageRank: 21,
    bestRank: 1,
    averageScore: 84,
    totalTournamentScore: 12540,
    completionRate: 91,
    lastTournamentAt: '2026-06-01T00:00:00.000Z',
  },
  meta: { timestamp: EXAMPLE_TIMESTAMP },
} as const;

export const USER_MY_TOURNAMENTS_EXAMPLE = {
  data: [
    {
      tournamentId: '660e8400-e29b-41d4-a716-446655440000',
      name: 'Spring Challenge',
      status: 'upcoming',
      registeredAt: '2026-06-01T00:00:00.000Z',
      startAt: '2026-06-05T00:00:00.000Z',
      endAt: '2026-06-10T00:00:00.000Z',
    },
  ],
  meta: {
    timestamp: EXAMPLE_TIMESTAMP,
    pagination: {
      limit: 20,
      hasNextPage: true,
      nextCursor:
        'eyJyZWdpc3RlcmVkQXQiOiAiMjAyNi0wNi0wMVQwMDowMDowMFoiLCAicGFydGljaXBhbnRJZCI6ICI2NjBlODQwMC1lMjliLTMxZDQtYTcxNi00NDY2NTY1NDQwMDAifQ==',
    },
  },
} as const;
