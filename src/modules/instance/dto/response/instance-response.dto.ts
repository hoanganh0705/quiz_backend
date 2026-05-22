import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';

export class InstancePlayerResponseDto {
  instancePlayerId!: string;
  instanceId!: string;
  userId!: string;
  username!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  status!: string;
  attemptId!: string | null;
  joinedAt!: string;
}

export class InstanceDetailResponseDto {
  instanceId!: string;
  quizVersionId!: string;
  hostUserId!: string;
  hostUsername!: string;
  hostDisplayName!: string | null;
  maxPlayers!: number | null;
  status!: string;
  versionNumber!: number;
  difficulty!: QuizDifficulty;
  durationMs!: number;
  passingScorePercent!: number;
  rewardXp!: number;
  quizId!: string;
  quizTitle!: string;
  quizSlug!: string;
  createdAt!: string;
  startedAt!: string | null;
  closedAt!: string | null;
  updatedAt!: string;
  players!: InstancePlayerResponseDto[];
}

export class CreateInstanceResponseDto {
  instanceId!: string;
  message!: string;
}

export class JoinInstanceResponseDto {
  message!: string;
}

export class StartInstanceResponseDto {
  message!: string;
}

export class CloseInstanceResponseDto {
  message!: string;
}

export class InstanceLeaderboardEntryDto {
  rank!: number;
  instancePlayerId!: string;
  userId!: string;
  username!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  status!: string;
  scorePercent!: string | null;
  correctCount!: number | null;
  timeTakenMs!: number | null;
}

export class InstanceLeaderboardResponseDto {
  instanceId!: string;
  items!: InstanceLeaderboardEntryDto[];
}
