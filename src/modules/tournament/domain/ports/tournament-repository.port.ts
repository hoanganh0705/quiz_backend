import type {
  TournamentDifficulty,
  TournamentStatus,
  TournamentRoundStatus,
  TournamentParticipantStatus,
  TournamentCursorPayload,
} from '../../types/tournament.types';

export type TournamentRow = {
  tournamentId: string;
  title: string;
  description: string | null;
  difficulty: TournamentDifficulty;
  status: TournamentStatus;
  prize: string | null;
  startAt: string;
  endAt: string;
  maxParticipants: number | null;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TournamentDetailRow = TournamentRow & {
  categoryName: string | null;
  categorySlug: string | null;
  totalParticipants: number;
};

export type TournamentRoundRow = {
  roundId: string;
  tournamentId: string;
  roundNumber: number;
  name: string;
  description: string | null;
  quizVersionId: string;
  startAt: string | null;
  endAt: string | null;
  durationMs: number | null;
  status: TournamentRoundStatus;
  isElimination: boolean;
  participantLimit: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TournamentRoundDetailRow = TournamentRoundRow & {
  versionNumber: number;
  difficulty: TournamentDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
};

export type TournamentParticipantRow = {
  participantId: string;
  tournamentId: string;
  userId: string;
  registeredAt: string;
  totalScore: number;
  totalTimeMs: number;
  rankFinal: number | null;
  status: TournamentParticipantStatus;
  updatedAt: string;
};

export type TournamentParticipantDetailRow = TournamentParticipantRow & {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type TournamentRoundParticipantRow = {
  roundParticipantId: string;
  roundId: string;
  participantId: string;
  attemptId: string | null;
  joinedAt: string;
  roundScore: number;
  roundTimeMs: number;
  rankInRound: number | null;
  isQualified: boolean;
  updatedAt: string;
};

export type TournamentLeaderboardEntry = TournamentParticipantDetailRow & {
  rank: number;
};

export type TournamentListFilters = {
  status?: TournamentStatus;
  difficulty?: TournamentDifficulty;
  categoryId?: string;
};

export interface TournamentRepositoryPort {
  getTournamentById(tournamentId: string): Promise<TournamentRow | null>;

  getTournamentDetailById(tournamentId: string): Promise<TournamentDetailRow | null>;

  listTournaments(params: {
    limit: number;
    cursor?: TournamentCursorPayload | null;
    filters?: TournamentListFilters;
  }): Promise<TournamentRow[]>;

  createTournament(params: {
    title: string;
    description: string | null;
    difficulty: TournamentDifficulty;
    prize: string | null;
    startAt: string;
    endAt: string;
    maxParticipants: number | null;
    categoryId: string | null;
    nowIso: string;
  }): Promise<{ tournamentId: string }>;

  getParticipant(participantId: string): Promise<TournamentParticipantRow | null>;

  getParticipantByUserAndTournament(
    userId: string,
    tournamentId: string,
  ): Promise<TournamentParticipantRow | null>;

  getParticipantById(participantId: string): Promise<TournamentParticipantRow | null>;

  registerParticipant(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
  }): Promise<TournamentParticipantRow>;

  getRoundById(roundId: string): Promise<TournamentRoundRow | null>;

  getRoundDetailById(roundId: string): Promise<TournamentRoundDetailRow | null>;

  getRoundsByTournament(tournamentId: string): Promise<TournamentRoundRow[]>;

  getRoundParticipant(
    roundId: string,
    participantId: string,
  ): Promise<TournamentRoundParticipantRow | null>;

  createRoundParticipant(params: {
    roundId: string;
    participantId: string;
    nowIso: string;
  }): Promise<TournamentRoundParticipantRow>;

  getLeaderboard(tournamentId: string): Promise<TournamentLeaderboardEntry[]>;

  countParticipants(tournamentId: string): Promise<number>;
}

export const TOURNAMENT_REPOSITORY_PORT = Symbol('TOURNAMENT_REPOSITORY_PORT');
