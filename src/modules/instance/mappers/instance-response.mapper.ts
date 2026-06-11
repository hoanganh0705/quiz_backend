import { Injectable } from '@nestjs/common';
import type {
  QuizInstanceDetailRow,
  QuizInstanceListRow,
  InstanceLeaderboardEntry,
  InstancePlayerWithProfile,
} from '../domain/ports';
import {
  InstanceDetailResponseDto,
  InstanceListItemDto,
  InstanceLeaderboardEntryDto,
  InstancePlayerResponseDto,
} from '../dto/response';

@Injectable()
export class InstanceResponseMapper {
  toInstanceDetailResponse(
    row: QuizInstanceDetailRow,
    players: InstancePlayerResponseDto[] = [],
  ): InstanceDetailResponseDto {
    return {
      instanceId: row.instanceId,
      quizVersionId: row.quizVersionId,
      hostUserId: row.hostUserId,
      hostUsername: row.hostUsername,
      hostDisplayName: row.hostDisplayName,
      maxPlayers: row.maxPlayers,
      status: row.status,
      versionNumber: row.versionNumber,
      difficulty: row.difficulty,
      durationMs: row.durationMs,
      passingScorePercent: row.passingScorePercent,
      rewardXp: row.rewardXp,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      quizSlug: row.quizSlug,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      closedAt: row.closedAt,
      updatedAt: row.updatedAt,
      players,
    };
  }

  toInstanceListItemResponse(row: QuizInstanceListRow): InstanceListItemDto {
    return {
      instanceId: row.instanceId,
      quizVersionId: row.quizVersionId,
      hostUserId: row.hostUserId,
      hostUsername: row.hostUsername,
      hostDisplayName: row.hostDisplayName,
      maxPlayers: row.maxPlayers,
      status: row.status,
      difficulty: row.difficulty,
      durationMs: row.durationMs,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      quizSlug: row.quizSlug,
      playerCount: row.playerCount,
      createdAt: row.createdAt,
    };
  }

  toLeaderboardEntryResponse(entry: InstanceLeaderboardEntry): InstanceLeaderboardEntryDto {
    return {
      rank: entry.rank,
      instancePlayerId: entry.instancePlayerId,
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      status: entry.status,
      scorePercent: entry.scorePercent !== null ? parseFloat(entry.scorePercent) : null,
      correctCount: entry.correctCount,
      timeTakenMs: entry.timeTakenMs,
    };
  }

  toInstancePlayerResponse(player: InstancePlayerWithProfile): InstancePlayerResponseDto {
    return {
      instancePlayerId: player.instancePlayerId,
      instanceId: player.instanceId,
      userId: player.userId,
      username: player.username,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      status: player.status,
      attemptId: player.attemptId,
      joinedAt: player.joinedAt,
    };
  }
}
