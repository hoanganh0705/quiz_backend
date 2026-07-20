import { Injectable } from '@nestjs/common';
import type {
  TournamentRow,
  TournamentDetailRow,
  TournamentRoundRow,
  TournamentLeaderboardEntry,
} from '../domain/ports';
import {
  TournamentResponseDto,
  TournamentDetailResponseDto,
  TournamentRoundResponseDto,
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
      // Phase 1 / Issue #2 — expose the ownership column on every
      // response so clients can render "you own this tournament"
      // affordances without an extra round-trip.
      ownerUserId: row.ownerUserId,
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
      ownerUserId: row.ownerUserId,
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
