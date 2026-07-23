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
  /**
   * Phase 1 (Foundational Correctness) — optimistic-locking version.
   * Internal concurrency primitive; not exposed via any response DTO.
   * Every state transition must read this value, then issue an UPDATE
   * with `WHERE version = $prev`. A zero-row result signals a lost race.
   */
  version: number;
  /**
   * Phase 2 (Gameplay Lifecycle) — wall-clock anchor the countdown
   * scheduler scans to find due transitions. Set by `startCountdown`,
   * cleared on completion or cancellation. Not exposed via any response
   * DTO; internal primitive of the state machine.
   */
  countdownStartedAt: string | null;
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
  // Phase 5 (audit issue 8.7): the repository now casts
  // `score_percent` to `double precision` so Drizzle returns a JS
  // number instead of a numeric-string. The previous `parseFloat`
  // workaround in `instance-response.mapper.ts` is no longer needed.
  scorePercent: number | null;
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
    /**
     * Phase 2 (Gameplay Lifecycle) — wall-clock anchor the scheduler
     * watches. The repository does NOT validate this against the
     * `status`; the constraint is enforced by the database CHECK
     * `quiz_instances_countdown_started_at_consistent`. The service
     * layer threads a value here only on `status: 'countdown'`, and
     * an explicit `null` here clears it on every other transition.
     */
    countdownStartedAt?: string | null;
    /**
     * Phase 1 (Foundational Correctness) — the version observed by the
     * caller before the transition. The UPDATE includes
     * `WHERE version = $expectedVersion`. If zero rows match, the
     * repository throws `InstanceOptimisticLockError` so the caller
     * knows another writer won the race.
     */
    expectedVersion: number;
  }): Promise<{ version: number }>;

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
      status?: 'open' | 'countdown' | 'running' | 'closed' | 'finished';
      difficulty?: string;
      quizId?: string;
      creatorId?: string;
    };
  }): Promise<QuizInstanceListRow[]>;

  /**
   * Phase 2 (Gameplay Lifecycle) — find all `countdown` instances whose
   * deadline has elapsed, so the scheduler can advance them. The query
   * hits the partial index `idx_quiz_instances_countdown_due`.
   */
  findDueCountdowns(params: { nowIso: string; limit: number }): Promise<
    Array<{
      instanceId: string;
      version: number;
      countdownStartedAt: string;
    }>
  >;

  listPlayersWithProfile(params: { instanceId: string }): Promise<InstancePlayerWithProfile[]>;

  /** Count the total number of instances hosted by a user. */
  countInstancesHostedByUser(userId: string): Promise<number>;

  /** Count the number of instances the user has finished playing (status = 'finished'). */
  countFinishedInstancesByUser(userId: string): Promise<number>;

  /** Fetch context fields (contextType, contextRefId) for a quiz attempt by its ID. */
  getAttemptContextInfo(attemptId: string): Promise<AttemptContextInfo | null>;
}

export const QUIZ_INSTANCE_REPOSITORY_PORT = Symbol('QUIZ_INSTANCE_REPOSITORY_PORT');
