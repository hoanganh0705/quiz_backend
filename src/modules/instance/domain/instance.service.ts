import { Inject, Injectable, Optional, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { decodeInstanceCursor } from '@/common/utils/cursor.util';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './ports';
import type { QuizInstanceRepositoryPort, InstanceCursorPayload } from './ports';
import { INSTANCE_DOMAIN_EVENT_BUS } from './events';
import type { InstanceDomainEventBusPort } from './events';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { QuizRepositoryPort } from '@/modules/quiz/domain/ports';
import { QuizNotFoundError, QuizVersionNotFoundError } from '@/modules/quiz/domain/errors';
import {
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  INSTANCE_ALREADY_FINISHED_MESSAGE,
  INSTANCE_NOT_IN_COUNTDOWN_MESSAGE,
  INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
  MIN_PLAYERS_NOT_MET_MESSAGE,
} from '../instance.constants';
import {
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  InstanceAlreadyFinishedError,
  PlayerAlreadyJoinedError,
  InstanceOptimisticLockError,
  MinPlayersNotMetError,
  InstanceNotInCountdownError,
  InstanceCountdownAlreadyStartedError,
} from './errors';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from './events';
import {
  INSTANCE_NOTIFICATION_PORT,
  type InstanceNotificationPort,
} from '@/modules/notification/domain/ports';

@Injectable()
export class InstanceService {
  constructor(
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly eventBus: InstanceDomainEventBusPort,
    @InjectPinoLogger(InstanceService.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(forwardRef(() => INSTANCE_NOTIFICATION_PORT))
    private readonly instanceNotifications?: InstanceNotificationPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository?: QuizRepositoryPort,
  ) {}

  async createInstance(params: {
    quizId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<{ instanceId: string; hostUserId: string }> {
    // Phase 1 (Foundational Correctness) — `quizId` → published
    // version resolution. We accept `quizId` on the wire (the public
    // identity for a quiz) and resolve it server-side to the
    // currently published version, so the wire shape never leaks the
    // internal `quizVersionId`/`versionNumber` pair.
    //
    // If the quiz is missing, surface a 404 `QUIZ_NOT_FOUND`. If the
    // quiz exists but has no published version (e.g. it's a draft),
    // surface a 404 `QUIZ_VERSION_NOT_FOUND` — there's nothing to
    // host in either case.
    if (!this.quizRepository) {
      throw new Error('QuizRepositoryPort is not configured for instance creation');
    }
    const quiz = await this.quizRepository.getQuizWithPublishedVersionById(params.quizId);
    if (!quiz) {
      throw new QuizNotFoundError();
    }
    if (!quiz.publishedVersionId) {
      throw new QuizVersionNotFoundError();
    }

    const nowIso = new Date().toISOString();
    const quizVersionId = quiz.publishedVersionId;

    const result = await this.instanceRepository.createInstanceWithHost({
      quizVersionId,
      hostUserId: params.user.sub,
      maxPlayers: params.maxPlayers,
      nowIso,
    });

    this.logger.info({
      event: 'instance_created',
      instanceId: result.instanceId,
      hostUserId: params.user.sub,
      quizId: params.quizId,
      quizVersionId,
    });

    this.eventBus.emitInstanceCreated(
      new InstanceCreatedEvent(
        result.instanceId,
        quizVersionId,
        params.user.sub,
        params.maxPlayers,
        nowIso,
      ),
    );

    return { instanceId: result.instanceId, hostUserId: params.user.sub };
  }

  async getInstanceById(instanceId: string): Promise<import('./ports').QuizInstanceDetailRow> {
    const instance = await this.instanceRepository.getInstanceDetailById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return instance;
  }

  async joinInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.status !== 'open') {
      throw new InstanceNotOpenError(INSTANCE_NOT_OPEN_MESSAGE);
    }

    try {
      const result = await this.instanceRepository.joinInstanceAtomic({
        instanceId,
        userId: user.sub,
        maxPlayers: instance.maxPlayers,
        nowIso,
      });

      // Phase 2 (issue 5.1): distinguish duplicate join from capacity-full.
      // Before Phase 2 both were conflated under `INSTANCE_FULL` (400), which
      // misled clients into thinking the instance was at capacity when the
      // user was actually already a member. `PlayerAlreadyJoinedError` is
      // mapped to 409 `PLAYER_ALREADY_JOINED` via ProblemCodeMapping.
      if (!result.joined) {
        throw new PlayerAlreadyJoinedError();
      }

      this.logger.info({
        event: 'player_joined',
        instanceId,
        userId: user.sub,
      });

      this.eventBus.emitPlayerJoined(
        new PlayerJoinedEvent(
          instanceId,
          user.sub,
          await this.instanceRepository.countPlayers(instanceId),
          nowIso,
        ),
      );

      const totalPlayers = await this.instanceRepository.countPlayers(instanceId);
      void this.notifyHostPlayerJoined({
        instanceId,
        hostUserId: instance.hostUserId,
        joiningUserId: user.sub,
        totalPlayers,
      });

      return { message: 'Joined the instance successfully' };
    } catch (error) {
      if (error instanceof Error && error.message === 'INSTANCE_FULL') {
        throw new InstanceFullError(INSTANCE_FULL_MESSAGE);
      }
      // Rethrow domain errors (PlayerAlreadyJoinedError, etc.) untouched.
      throw error;
    }
  }

  async startInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    // Phase 2 (Gameplay Lifecycle) — the state machine is now:
    //   open → countdown → running → closed/finished.
    //
    // The Phase 1 contract was `open → running`. The host now
    // transitions `open → countdown` via `startCountdown`, and
    // `startInstance` represents the `countdown → running` step.
    // This matches the review's countdown-as-explicit-state deliverable.
    //
    //   - `open`      → never call startInstance without going through countdown
    //   - `countdown` → the supported entry point
    //   - `running`   → already started
    //   - `closed` / `finished` → already terminal
    if (instance.status === 'open') {
      throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
    }
    if (instance.status === 'running') {
      throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
    }
    if (instance.status === 'closed' || instance.status === 'finished') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }

    // Phase 2 (Required Fix) — minimum player validation. The instance
    // is a multiplayer-only room; a one-player game is not a valid
    // game per the review's foundational correctness fix. The check
    // fires *before* the optimistic-locking UPDATE so the host sees
    // a 422 `MIN_PLAYERS_NOT_MET` rather than a 409.
    const totalPlayers = await this.instanceRepository.countPlayers(instanceId);
    if (totalPlayers < InstanceService.MIN_PLAYERS_PER_INSTANCE) {
      throw new MinPlayersNotMetError(MIN_PLAYERS_NOT_MET_MESSAGE);
    }

    // Phase 1 (Foundational Correctness) — the optimistic-lock guard.
    // `instance.version` is the version observed by this read. The
    // repository issues `UPDATE … WHERE version = $instance.version`
    // and increments it in the same statement. A concurrent
    // `startInstance` that read the same version would now see a
    // zero-row UPDATE and throw `InstanceOptimisticLockError`; the
    // remaining caller is the only one that wins.
    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'running',
        startedAt: nowIso,
        // Phase 2 — running instances must not carry a countdown anchor.
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        // Re-read to translate the conflict into the precise state-machine
        // error: if the row is now `running`, the other caller won the
        // start, so we surface `InstanceAlreadyStartedError`. Otherwise
        // the row was closed/finished first.
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'running') {
          throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
        }
        if (latest?.status === 'closed' || latest?.status === 'finished') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_started',
      instanceId,
      userId: user.sub,
    });

    this.eventBus.emitInstanceStarted(new InstanceStartedEvent(instanceId, user.sub, nowIso));

    return { message: 'Instance started' };
  }

  async closeInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    // Phase 3 (issue 7.1): differentiate state-machine paths. The audit
    // documented three states (`open → running → closed`) but the DB
    // includes a fourth (`finished`) for terminal/soft-archive use.
    //   - `closed`   → user-closed     → `InstanceAlreadyClosedError`
    //   - `finished` → terminal archive → `InstanceAlreadyFinishedError`
    // Previously both paths conflated under `INSTANCE_ALREADY_CLOSED`,
    // making the wire shape ambiguous for callers inspecting
    // `extensions.code`.
    if (instance.status === 'closed') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }
    if (instance.status === 'finished') {
      throw new InstanceAlreadyFinishedError(INSTANCE_ALREADY_FINISHED_MESSAGE);
    }

    // Phase 1 (Foundational Correctness) — optimistic-lock guard, see
    // the symmetric note in `startInstance` above.
    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'closed',
        closedAt: nowIso,
        // Phase 2 — clear the countdown anchor so a closed instance
        // never carries a stale `countdownStartedAt`. The DB CHECK
        // `quiz_instances_countdown_started_at_consistent` requires
        // this. The explicit `null` matches `instance_statuses_closed`.
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'closed') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
        if (latest?.status === 'finished') {
          throw new InstanceAlreadyFinishedError(INSTANCE_ALREADY_FINISHED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_closed',
      instanceId,
      userId: user.sub,
    });

    this.eventBus.emitInstanceClosed(new InstanceClosedEvent(instanceId, user.sub, nowIso));

    // Phase 2 — if the instance was in `countdown` at the moment of
    // closing, surface the cancellation so connected clients can drop
    // their warmup UI before the room tears down.
    if (instance.status === 'countdown') {
      this.eventBus.emitCountdownCancelled(
        new CountdownCancelledEvent(instanceId, user.sub, 'instance_closed', nowIso),
      );
    }

    return { message: 'Instance closed' };
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — minimum players required to start a
   * countdown or auto-start a countdown-elapsed game. The instance is a
   * multiplayer-only room; one-player games are not a valid game per
   * the review's foundational correctness fix.
   *
   * Encoded as a constant rather than a constructor parameter so the
   * "Required Fix" (instance = multiplayer room, minimum 2) stays a
   * single source of truth.
   */
  static readonly MIN_PLAYERS_PER_INSTANCE = 2;

  /**
   * Phase 2 (Gameplay Lifecycle) — host-driven transition `open →
   * countdown`. Persists `countdownStartedAt = now`, validates the
   * state precondition (`open`), and emits `CountdownStartedEvent`
   * which the WebSocket layer forwards as `countdown_started`.
   *
   * Idempotency: a second call against an already-countdown instance
   * throws `InstanceCountdownAlreadyStartedError`; the controller
   * catches it and returns the existing `countdownStartedAt` so the
   * client sees a no-op retry as success.
   *
   * Why not require ≥2 players here
   * --------------------------------
   * The review lists "minimum player validation in `startInstance`"
   * as the deliverable. While in `countdown` the lobby can still
   * receive late joiners; the gate fires on the actual
   * `countdown → running` transition. We do, however, persist
   * `countdownStartedAt` here and let `startInstance` (and the
   * scheduler) reject the running transition if the count has
   * dropped.
   */
  async startCountdown(
    instanceId: string,
    user: JwtPayload,
  ): Promise<{
    instanceId: string;
    status: 'countdown';
    countdownStartedAt: string;
    countdownEndsAt: string;
  }> {
    const nowIso = new Date().toISOString();
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }
    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status === 'countdown') {
      // Idempotent retry — surface as a domain error so the
      // controller can fold it into a 200 response carrying the
      // existing anchor.
      throw new InstanceCountdownAlreadyStartedError(INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE);
    }
    if (instance.status !== 'open') {
      // `running` / `closed` / `finished` all reject.
      throw new InstanceNotOpenError(INSTANCE_NOT_OPEN_MESSAGE);
    }

    const countdownStartedAt = nowIso;
    const countdownEndsAt = new Date(
      new Date(countdownStartedAt).getTime() + InstanceService.COUNTDOWN_DURATION_MS,
    ).toISOString();

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'countdown',
        countdownStartedAt,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest?.status === 'countdown') {
          throw new InstanceCountdownAlreadyStartedError(
            INSTANCE_COUNTDOWN_ALREADY_STARTED_MESSAGE,
          );
        }
        if (latest?.status === 'running') {
          throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
        }
        if (latest?.status === 'closed' || latest?.status === 'finished') {
          throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_started',
      instanceId,
      userId: user.sub,
      countdownStartedAt,
      countdownEndsAt,
    });

    this.eventBus.emitCountdownStarted(
      new CountdownStartedEvent(instanceId, user.sub, countdownStartedAt, countdownEndsAt, nowIso),
    );

    return { instanceId, status: 'countdown', countdownStartedAt, countdownEndsAt };
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — host-driven transition
   * `countdown → open`. Clears `countdownStartedAt` and emits
   * `CountdownCancelledEvent`.
   *
   * Cancellation semantics
   * ----------------------
   *
   *   - Host cancellation: explicit, idempotent.
   *   - Host disconnect during countdown: the existing socket
   *     disconnect path (`handlePlayerLeftSocket`) becomes a
   *     countdown-cancellation trigger in Phase 3 (Host Transfer).
   *     For Phase 2 we expose this method as the only path so the
   *     surface is small and reviewable.
   *   - Instance close while in countdown: `closeInstance` already
   *     emits `CountdownCancelledEvent` with `reason =
   *     'instance_closed'` — see the dual-emit at the bottom of
   *     `closeInstance`.
   */
  async cancelCountdown(
    instanceId: string,
    user: JwtPayload,
    reason: 'host_cancelled' | 'host_disconnected' = 'host_cancelled',
  ): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }
    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }
    if (instance.status !== 'countdown') {
      throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
    }

    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId,
        status: 'open',
        // Phase 2 — clear the countdown anchor so a non-countdown row
        // never carries a stale `countdownStartedAt`. Required by the
        // DB CHECK `quiz_instances_countdown_started_at_consistent`.
        countdownStartedAt: null,
        nowIso,
        expectedVersion: instance.version,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        const latest = await this.instanceRepository.getInstanceById(instanceId);
        if (latest && latest.status !== 'countdown') {
          throw new InstanceNotInCountdownError(INSTANCE_NOT_IN_COUNTDOWN_MESSAGE);
        }
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_cancelled',
      instanceId,
      userId: user.sub,
      reason,
    });

    this.eventBus.emitCountdownCancelled(
      new CountdownCancelledEvent(instanceId, user.sub, reason, nowIso),
    );

    return { message: 'Countdown cancelled' };
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — scheduler-driven `countdown →
   * running` transition. Invoked by `InstanceCountdownSchedulerService`
   * once per second to find and complete due countdowns.
   *
   * Phase 3 (Host Transfer) will call this from a `host_disconnected`
   * path as well. For Phase 2 the scheduler is the only caller.
   *
   * The minimum-player check is enforced here — the scheduler MUST
   * refuse to start a one-player countdown. The instance is back to
   * `open` (with `countdownStartedAt` cleared) so the host can
   * re-attempt once more players join. The cancellation event carries
   * the `host_disconnected`-style reason so clients can render the
   * "awaiting more players" UI consistently.
   */
  async completeCountdownByScheduler(params: {
    instanceId: string;
    expectedVersion: number;
  }): Promise<
    | { completed: true; status: 'running'; startedAt: string }
    | { completed: false; reason: 'min_players_not_met' | 'state_changed' | 'lost_lock' }
  > {
    const nowIso = new Date().toISOString();
    const instance = await this.instanceRepository.getInstanceById(params.instanceId);

    if (!instance || instance.status !== 'countdown') {
      return { completed: false, reason: 'state_changed' };
    }

    const totalPlayers = await this.instanceRepository.countPlayers(params.instanceId);
    if (totalPlayers < InstanceService.MIN_PLAYERS_PER_INSTANCE) {
      // The scheduler fires the cancellation instead of letting the
      // instance sit forever in `countdown`. The state goes back to
      // `open` so the host can re-arm once enough players have joined.
      try {
        await this.instanceRepository.updateInstanceStatus({
          instanceId: params.instanceId,
          status: 'open',
          countdownStartedAt: null,
          nowIso,
          expectedVersion: params.expectedVersion,
        });
      } catch (error) {
        if (error instanceof InstanceOptimisticLockError) {
          return { completed: false, reason: 'lost_lock' };
        }
        throw error;
      }

      this.logger.info({
        event: 'instance_countdown_auto_cancelled',
        instanceId: params.instanceId,
        reason: 'min_players_not_met',
        totalPlayers,
      });

      this.eventBus.emitCountdownCancelled(
        new CountdownCancelledEvent(
          params.instanceId,
          instance.hostUserId,
          'host_disconnected',
          nowIso,
        ),
      );

      return { completed: false, reason: 'min_players_not_met' };
    }

    // Phase 1 — optimistic-lock guard. The scheduler passes the
    // version it observed when listing due rows; if the host has
    // cancelled since then, the UPDATE matches zero rows and we
    // surface `lost_lock` so the scheduler can move on.
    try {
      await this.instanceRepository.updateInstanceStatus({
        instanceId: params.instanceId,
        status: 'running',
        startedAt: nowIso,
        // Phase 2 — running instances must not carry a countdown
        // anchor; clear it on the transition.
        countdownStartedAt: null,
        nowIso,
        expectedVersion: params.expectedVersion,
      });
    } catch (error) {
      if (error instanceof InstanceOptimisticLockError) {
        return { completed: false, reason: 'lost_lock' };
      }
      throw error;
    }

    this.logger.info({
      event: 'instance_countdown_completed',
      instanceId: params.instanceId,
      startedAt: nowIso,
    });

    this.eventBus.emitCountdownCompleted(
      new CountdownCompletedEvent(params.instanceId, nowIso, nowIso),
    );
    this.eventBus.emitInstanceStarted(
      new InstanceStartedEvent(params.instanceId, instance.hostUserId, nowIso),
    );

    return { completed: true, status: 'running', startedAt: nowIso };
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — countdown duration. Persisted in
   * the column `countdown_started_at` and exposed as
   * `countdownEndsAt` on the WebSocket event. The scheduler fires
   * the `countdown → running` transition when `countdown_started_at +
   * COUNTDOWN_DURATION_MS <= now()`.
   *
   * 5 seconds matches the multiplayer-room feel used in the
   * reference architecture. Tunable via env in a later phase.
   */
  static readonly COUNTDOWN_DURATION_MS = 5_000;

  async getLeaderboard(params: {
    instanceId: string;
    limit: number;
    cursor?: import('./ports').LeaderboardCursorPayload | null;
  }): Promise<{ items: import('./ports').InstanceLeaderboardEntry[]; hasNextPage: boolean }> {
    const instance = await this.instanceRepository.getInstanceById(params.instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.getLeaderboard(params);
  }

  async getInstancePlayers(instanceId: string): Promise<import('./ports').QuizInstancePlayerRow[]> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.listPlayers(instanceId);
  }

  async isPlayerInInstance(instanceId: string, userId: string): Promise<boolean> {
    const player = await this.instanceRepository.getPlayer(instanceId, userId);
    return player !== null;
  }

  async isHost(instanceId: string, userId: string): Promise<boolean> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);
    return instance?.hostUserId === userId;
  }

  async listInstances(params: {
    limit: number;
    cursor?: string | null;
    filters?: {
      status?: string;
      difficulty?: string;
      quizId?: string;
      creatorId?: string;
    };
  }): Promise<{
    rows: import('./ports').QuizInstanceListRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const limit = params.limit ?? 20;
    const cursorValue = typeof params.cursor === 'string' ? params.cursor : undefined;

    // Phase 2 (issue 2.4): validate the cursor shape so a tampered or
    // malformed payload can't reach the SQL layer as `undefined`.
    const cursor: InstanceCursorPayload | null = cursorValue
      ? decodeInstanceCursor(cursorValue)
      : null;

    const rows = await this.instanceRepository.listInstances({
      limit,
      cursor,
      filters: params.filters as
        | {
            status?: 'open' | 'countdown' | 'running' | 'closed' | 'finished';
            difficulty?: string;
            quizId?: string;
            creatorId?: string;
          }
        | undefined,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      rows: items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? // Phase 2 (issue 2.5): normalize `createdAt` to ISO 8601 so
            //   the cursor round-trips through any client that decodes
            //   it without encountering PG-formatted timestamps.
            // Phase 4 (audit issue 2.9): switched to base64url to align
            //   with the rest of the codebase (the leaderboard cursor
            //   already used base64url). base64url is a strict subset
            //   of base64 — Node's `Buffer.from(s, 'base64')` decoder
            //   accepts both encodings, so existing clients keep
            //   working.
            Buffer.from(
              JSON.stringify({
                createdAt: new Date(lastItem.createdAt).toISOString(),
                instanceId: lastItem.instanceId,
              }),
            ).toString('base64url')
          : null,
    };
  }

  async listInstancePlayers(
    instanceId: string,
    params: {
      limit: number;
      cursor?: { joinedAt: string; instancePlayerId: string } | null;
    },
  ): Promise<{
    items: import('./ports').InstancePlayerWithProfile[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    const { items, hasNextPage } = await this.instanceRepository.listPlayersWithProfile({
      instanceId,
      limit: params.limit,
      cursor: params.cursor ?? null,
    });

    const lastItem = items.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({
              joinedAt: new Date(lastItem.joinedAt).toISOString(),
              instancePlayerId: lastItem.instancePlayerId,
            }),
            'utf8',
          ).toString('base64url')
        : null;

    return { items, hasNextPage, nextCursor };
  }

  async notifyHostPlayerJoined(params: {
    instanceId: string;
    hostUserId: string;
    joiningUserId: string;
    totalPlayers: number;
  }): Promise<void> {
    await this.sendHostNotification({
      userId: params.hostUserId,
      title: 'Player Joined',
      body: `A player joined your quiz instance (${params.totalPlayers} player${params.totalPlayers !== 1 ? 's' : ''} online).`,
      metadata: {
        instanceId: params.instanceId,
        joiningUserId: params.joiningUserId,
        event: 'player_joined',
      },
    });
  }

  async notifyHostPlayerDisconnected(params: {
    instanceId: string;
    hostUserId: string;
    leavingUserId: string;
    totalPlayers: number;
  }): Promise<void> {
    await this.sendHostNotification({
      userId: params.hostUserId,
      title: 'Player Left',
      body: `A player left your quiz instance (${params.totalPlayers} player${params.totalPlayers !== 1 ? 's' : ''} online).`,
      metadata: {
        instanceId: params.instanceId,
        leavingUserId: params.leavingUserId,
        event: 'player_disconnected',
      },
    });
  }

  private async sendHostNotification(params: {
    userId: string;
    title: string;
    body: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (!this.instanceNotifications) {
      this.logger.warn({
        event: 'instance_notification_port_unavailable',
        message: 'INSTANCE_NOTIFICATION_PORT not injected; skipping notification',
      });
      return;
    }

    try {
      await this.instanceNotifications.notifyHostSystemAnnouncement({
        userId: params.userId,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
      });

      this.logger.debug({
        event: 'host_notification_sent',
        userId: params.userId,
        title: params.title,
      });
    } catch (error) {
      this.logger.error({
        event: 'host_notification_failed',
        userId: params.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
