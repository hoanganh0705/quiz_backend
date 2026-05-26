export const TOURNAMENT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type TournamentDifficulty = 'easy' | 'medium' | 'hard';

export const TOURNAMENT_STATUSES = [
  'upcoming',
  'registration',
  'ongoing',
  'finished',
  'cancelled',
] as const;

export type TournamentStatus = 'upcoming' | 'registration' | 'ongoing' | 'finished' | 'cancelled';

export const TOURNAMENT_ROUND_STATUSES = ['pending', 'open', 'running', 'finished'] as const;

export type TournamentRoundStatus = 'pending' | 'open' | 'running' | 'finished';

export const TOURNAMENT_PARTICIPANT_STATUSES = ['active', 'disqualified', 'withdrawn'] as const;

export type TournamentParticipantStatus = 'active' | 'disqualified' | 'withdrawn';

export type TournamentCursorPayload = {
  createdAt: string;
  tournamentId: string;
};
