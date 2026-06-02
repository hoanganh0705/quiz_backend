import { Injectable } from '@nestjs/common';
import type {
  QuizInstanceDetailRow,
  QuizInstancePlayerRow,
  InstanceLeaderboardEntry,
} from '../domain/ports';
import {
  InstanceDetailResponseDto,
  InstanceLeaderboardEntryDto,
  InstancePlayerResponseDto,
} from '../dto/response';

@Injectable()
export class InstanceResponseMapper {
  toInstanceDetailResponse(row: QuizInstanceDetailRow): InstanceDetailResponseDto {
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
      players: [],
    };
  }

  toPlayerResponse(row: QuizInstancePlayerRow): InstancePlayerResponseDto {
    return {
      instancePlayerId: row.instancePlayerId,
      instanceId: row.instanceId,
      userId: row.userId,
      username: '',
      displayName: null,
      avatarUrl: null,
      status: row.status,
      attemptId: row.attemptId,
      joinedAt: row.joinedAt,
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
      scorePercent: entry.scorePercent,
      correctCount: entry.correctCount,
      timeTakenMs: entry.timeTakenMs,
    };
  }
}
