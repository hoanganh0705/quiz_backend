import type { TournamentDifficulty, TournamentStatus, TournamentRoundStatus } from '../../types/tournament.types';

export class TournamentRoundResponseDto {
  roundId!: string;
  tournamentId!: string;
  roundNumber!: number;
  name!: string;
  description!: string | null;
  quizVersionId!: string;
  startAt!: string | null;
  endAt!: string | null;
  durationMs!: number | null;
  status!: TournamentRoundStatus;
  isElimination!: boolean;
  participantLimit!: number | null;
  createdAt!: string;
  updatedAt!: string;
}

export class TournamentResponseDto {
  tournamentId!: string;
  title!: string;
  description!: string | null;
  difficulty!: TournamentDifficulty;
  status!: TournamentStatus;
  prize!: string | null;
  startAt!: string;
  endAt!: string;
  maxParticipants!: number | null;
  categoryId!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class TournamentDetailResponseDto extends TournamentResponseDto {
  categoryName!: string | null;
  categorySlug!: string | null;
  totalParticipants!: number;
  rounds!: TournamentRoundResponseDto[];
}

export class TournamentListResponseDto {
  items!: TournamentResponseDto[];
  pagination!: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export class TournamentParticipantResponseDto {
  participantId!: string;
  tournamentId!: string;
  userId!: string;
  registeredAt!: string;
  totalScore!: number;
  totalTimeMs!: number;
  rankFinal!: number | null;
  status!: string;
  updatedAt!: string;
}

export class TournamentLeaderboardEntryDto {
  rank!: number;
  participantId!: string;
  userId!: string;
  username!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  totalScore!: number;
  totalTimeMs!: number;
  rankFinal!: number | null;
  status!: string;
}

export class TournamentLeaderboardResponseDto {
  items!: TournamentLeaderboardEntryDto[];
}

export class RegisterTournamentResponseDto {
  participantId!: string;
  tournamentId!: string;
  userId!: string;
  registeredAt!: string;
  message!: string;
}

export class StartTournamentAttemptResponseDto {
  attemptId!: string;
  quizVersionId!: string;
  participantId!: string;
  message!: string;
}
