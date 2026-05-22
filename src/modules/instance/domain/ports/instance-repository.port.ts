import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';

export type QuizInstanceRow = {
  instanceId: string;
  quizVersionId: string;
  hostUserId: string;
  maxPlayers: number | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
};

export type QuizInstanceDetailRow = QuizInstanceRow & {
  versionNumber: number;
  difficulty: QuizDifficulty;
  durationMs: number;
  passingScorePercent: number;
  rewardXp: number;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  quizCreatorId: string | null;
  hostUsername: string;
  hostDisplayName: string | null;
};

export type QuizInstancePlayerRow = {
  instancePlayerId: string;
  instanceId: string;
  userId: string;
  attemptId: string | null;
  status: string;
  joinedAt: string;
  leftAt: string | null;
};

export type QuizInstancePlayerDetailRow = QuizInstancePlayerRow & {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type InstanceLeaderboardEntry = QuizInstancePlayerDetailRow & {
  scorePercent: string | null;
  correctCount: number | null;
  timeTakenMs: number | null;
  rank: number;
};

export interface QuizInstanceRepositoryPort {
  createInstance(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string }>;

  getInstanceById(instanceId: string): Promise<QuizInstanceRow | null>;

  getInstanceDetailById(instanceId: string): Promise<QuizInstanceDetailRow | null>;

  updateInstanceStatus(params: {
    instanceId: string;
    status: string;
    nowIso: string;
    startedAt?: string;
    closedAt?: string;
  }): Promise<void>;

  getPlayer(instanceId: string, userId: string): Promise<QuizInstancePlayerRow | null>;

  getPlayerById(instancePlayerId: string): Promise<QuizInstancePlayerRow | null>;

  getPlayerDetail(instanceId: string, userId: string): Promise<QuizInstancePlayerDetailRow | null>;

  listPlayers(instanceId: string): Promise<QuizInstancePlayerRow[]>;

  addPlayer(params: {
    instanceId: string;
    userId: string;
    nowIso: string;
  }): Promise<QuizInstancePlayerRow>;

  updatePlayerStatus(params: {
    instancePlayerId: string;
    status: string;
    attemptId?: string | null;
    nowIso: string;
  }): Promise<void>;

  updatePlayerByInstanceAndUser(params: {
    instanceId: string;
    userId: string;
    status: string;
    attemptId?: string | null;
  }): Promise<void>;

  getLeaderboard(instanceId: string): Promise<InstanceLeaderboardEntry[]>;

  countPlayers(instanceId: string): Promise<number>;
}

export const QUIZ_INSTANCE_REPOSITORY_PORT = Symbol('QUIZ_INSTANCE_REPOSITORY_PORT');
