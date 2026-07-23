import { Injectable } from '@nestjs/common';
import type {
  QuizInstanceDetailRow,
  QuizInstanceListRow,
  InstanceLeaderboardEntry,
  InstancePlayerWithProfile,
} from '../domain/ports';
import type { QuizInstanceStatus, QuizInstancePlayerStatus } from '../types/instance.types';
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
      // Phase 1 (Foundational Correctness) — drop quizVersionId &
      // versionNumber from the wire. They are internal implementation
      // details: the published version is resolved from the parent
      // quiz and may change as the quiz author publishes new versions,
      // so leaking it to clients would make stale versions hard to
      // reason about.
      hostUserId: row.hostUserId,
      hostUsername: row.hostUsername,
      hostDisplayName: row.hostDisplayName,
      maxPlayers: row.maxPlayers,
      status: row.status as QuizInstanceStatus,
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
      // Phase 1 (Foundational Correctness) — drop quizVersionId from
      // the list wire shape (see `toInstanceDetailResponse`).
      hostUserId: row.hostUserId,
      hostUsername: row.hostUsername,
      hostDisplayName: row.hostDisplayName,
      maxPlayers: row.maxPlayers,
      status: row.status as QuizInstanceStatus,
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
      status: entry.status as QuizInstancePlayerStatus,
      scorePercent: entry.scorePercent,
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
      status: player.status as QuizInstancePlayerStatus,
      attemptId: player.attemptId,
      joinedAt: player.joinedAt,
    };
  }
}
