import { Injectable } from '@nestjs/common';
import type {
  TournamentRow,
  TournamentDetailRow,
  TournamentRoundRow,
  TournamentParticipantRow,
  TournamentLeaderboardEntry,
} from '../domain/ports';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentRoundResponseDto,
  TournamentParticipantResponseDto,
  TournamentLeaderboardEntryDto,
} from '../dto/response';

@Injectable()
export class TournamentResponseMapper {
  toTournamentResponse(row: TournamentRow): TournamentResponseDto {
    return {
      tournamentId: row.tournamentId,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      status: row.status,
      prize: row.prize,
      startAt: row.startAt,
      endAt: row.endAt,
      maxParticipants: row.maxParticipants,
      categoryId: row.categoryId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toTournamentDetailResponse(
    row: TournamentDetailRow,
    rounds: TournamentRoundRow[],
  ): TournamentDetailResponseDto {
    return {
      tournamentId: row.tournamentId,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      status: row.status,
      prize: row.prize,
      startAt: row.startAt,
      endAt: row.endAt,
      maxParticipants: row.maxParticipants,
      categoryId: row.categoryId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      totalParticipants: row.totalParticipants,
      rounds: rounds.map((r) => this.toRoundResponse(r)),
    };
  }

  toRoundResponse(row: TournamentRoundRow): TournamentRoundResponseDto {
    return {
      roundId: row.roundId,
      tournamentId: row.tournamentId,
      roundNumber: row.roundNumber,
      name: row.name,
      description: row.description,
      quizVersionId: row.quizVersionId,
      startAt: row.startAt,
      endAt: row.endAt,
      durationMs: row.durationMs,
      status: row.status,
      isElimination: row.isElimination,
      participantLimit: row.participantLimit,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toParticipantResponse(row: TournamentParticipantRow): TournamentParticipantResponseDto {
    return {
      participantId: row.participantId,
      tournamentId: row.tournamentId,
      userId: row.userId,
      registeredAt: row.registeredAt,
      totalScore: row.totalScore,
      totalTimeMs: row.totalTimeMs,
      rankFinal: row.rankFinal,
      status: row.status,
      updatedAt: row.updatedAt,
    };
  }

  toLeaderboardEntryResponse(row: TournamentLeaderboardEntry): TournamentLeaderboardEntryDto {
    return {
      rank: row.rank,
      participantId: row.participantId,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      totalScore: row.totalScore,
      totalTimeMs: row.totalTimeMs,
      rankFinal: row.rankFinal,
      status: row.status,
    };
  }
}
