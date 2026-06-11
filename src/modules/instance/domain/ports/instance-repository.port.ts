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

export type QuizInstanceListRow = QuizInstanceDetailRow & {
  playerCount: number;
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

export type InstanceLeaderboardEntry = {
  instancePlayerId: string;
  instanceId: string;
  userId: string;
  attemptId: string | null;
  status: string;
  joinedAt: string;
  leftAt: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  scorePercent: string | null;
  correctCount: number | null;
  timeTakenMs: number | null;
  rank: number;
};

export type InstancePlayerWithProfile = {
  instancePlayerId: string;
  instanceId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  attemptId: string | null;
  joinedAt: string;
};

export type InstanceCursorPayload = {
  createdAt: string;
  instanceId: string;
};

export type LeaderboardCursorPayload = {
  rank: number;
  instancePlayerId: string;
};

/** Minimal context fields needed from a quiz attempt to route instance events. */
export type AttemptContextInfo = {
  contextType: string;
  contextRefId: string | null;
};

export interface QuizInstanceRepositoryPort {
  createInstance(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string }>;

  createInstanceWithHost(params: {
    quizVersionId: string;
    hostUserId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ instanceId: string; hostPlayerId: string }>;

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

  listPlayers(instanceId: string): Promise<QuizInstancePlayerRow[]>;

  addPlayer(params: {
    instanceId: string;
    userId: string;
    nowIso: string;
  }): Promise<QuizInstancePlayerRow>;

  joinInstanceAtomic(params: {
    instanceId: string;
    userId: string;
    maxPlayers: number | null;
    nowIso: string;
  }): Promise<{ joined: boolean; player?: QuizInstancePlayerRow }>;

  getLeaderboard(params: {
    instanceId: string;
    limit: number;
    cursor?: LeaderboardCursorPayload | null;
  }): Promise<{ items: InstanceLeaderboardEntry[]; hasNextPage: boolean }>;

  countPlayers(instanceId: string): Promise<number>;

  linkAttemptToPlayer(params: {
    instanceId: string;
    userId: string;
    attemptId: string;
    status: string;
  }): Promise<void>;

  updatePlayerStatus(params: { instanceId: string; userId: string; status: string }): Promise<void>;

  getPlayerByUserAndInstance(params: {
    instanceId: string;
    userId: string;
  }): Promise<QuizInstancePlayerRow | null>;

  listInstances(params: {
    limit: number;
    cursor?: InstanceCursorPayload | null;
    filters?: {
      status?: 'open' | 'running' | 'closed' | 'finished';
      difficulty?: string;
    };
  }): Promise<QuizInstanceListRow[]>;

  listPlayersWithProfile(params: { instanceId: string }): Promise<InstancePlayerWithProfile[]>;

  /** Count the total number of instances hosted by a user. */
  countInstancesHostedByUser(userId: string): Promise<number>;

  /** Count the number of instances the user has finished playing (status = 'finished'). */
  countFinishedInstancesByUser(userId: string): Promise<number>;

  /** Fetch context fields (contextType, contextRefId) for a quiz attempt by its ID. */
  getAttemptContextInfo(attemptId: string): Promise<AttemptContextInfo | null>;
}

export const QUIZ_INSTANCE_REPOSITORY_PORT = Symbol('QUIZ_INSTANCE_REPOSITORY_PORT');
