import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { InstanceService } from '../domain/instance.service';
import { INSTANCE_DOMAIN_EVENT_BUS } from '../domain/events';
import type { InstanceDomainEventBusPort } from '../domain/events';
import { SOCKET_CONNECTION_REGISTRY_PORT } from '../domain/ports';
import type { SocketConnectionRegistryPort } from '../domain/ports';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  PlayerAttemptStartedEvent,
  PlayerXpEarnedEvent,
  PlayerFinishedEvent,
  PlayerDisconnectedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from '../domain/events';
import { InstanceCountdownAlreadyStartedError } from '../domain/errors';
import type { Server } from 'socket.io';
import { InstanceResponseMapper } from '../mappers/instance-response.mapper';
import type { LeaderboardCursorPayload } from '../domain/ports';
import {
  CloseInstanceResponseDto,
  CreateInstanceResponseDto,
  InstanceDetailResponseDto,
  InstanceLeaderboardResponseDto,
  InstanceListResponseDto,
  InstancePlayersResponseDto,
  JoinInstanceResponseDto,
  StartCountdownResponseDto,
  StartInstanceResponseDto,
} from '../dto/response';

/**
 * Orchestrates Instance domain operations and Socket.IO real-time event emission.
 *
 * This service sits between the WebSocket gateway and the domain layer.
 * The gateway delegates all business logic here and emits Socket.IO events
 * based on domain events emitted by InstanceService.
 *
 * Architecture:
 *   Gateway → InstanceApplicationService → InstanceService (domain)
 *                                         ↘ InstanceDomainEventBus → InstanceApplicationService (event subscription)
 *                                                               ↘ Socket.IO server (cross-instance via RedisIoAdapter)
 *
 * Phase 3 (Production Deployment Readiness) — added:
 *   - SocketConnectionRegistryPort dependency for cross-instance
 *     socketId → {instanceId, userId} tracking. The previous
 *     process-local Map only worked in single-process deployments;
 *     under horizontal scaling a socket that disconnects on
 *     instance B is no longer visible to the in-process map on
 *     instance A, so `PlayerDisconnectedEvent` was being silently
 *     dropped. The Redis-backed registry fixes that.
 */
@Injectable()
export class InstanceApplicationService {
  private server: Server | null = null;

  constructor(
    private readonly instanceService: InstanceService,
    private readonly mapper: InstanceResponseMapper,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly eventBus: InstanceDomainEventBusPort,
    @Inject(SOCKET_CONNECTION_REGISTRY_PORT)
    private readonly socketConnectionRegistry: SocketConnectionRegistryPort,
    @InjectPinoLogger(InstanceApplicationService.name)
    private readonly logger: PinoLogger,
  ) {
    this.subscribeToDomainEvents();
  }

  setServer(server: Server): void {
    this.server = server;
  }

  private subscribeToDomainEvents(): void {
    this.eventBus.subscribe((event) => {
      if (event instanceof InstanceCreatedEvent) {
        this.onInstanceCreated(event);
      } else if (event instanceof PlayerJoinedEvent) {
        this.onPlayerJoined(event);
      } else if (event instanceof PlayerAttemptStartedEvent) {
        this.onPlayerAttemptStarted(event);
      } else if (event instanceof PlayerXpEarnedEvent) {
        this.onPlayerXpEarned(event);
      } else if (event instanceof PlayerFinishedEvent) {
        this.onPlayerFinished(event);
      } else if (event instanceof PlayerDisconnectedEvent) {
        this.onPlayerDisconnected(event);
      } else if (event instanceof InstanceStartedEvent) {
        this.onInstanceStarted(event);
      } else if (event instanceof InstanceClosedEvent) {
        this.onInstanceClosed(event);
      } else if (event instanceof CountdownStartedEvent) {
        this.onCountdownStarted(event);
      } else if (event instanceof CountdownCancelledEvent) {
        this.onCountdownCancelled(event);
      } else if (event instanceof CountdownCompletedEvent) {
        this.onCountdownCompleted(event);
      }
    });
  }

  async createInstance(params: {
    quizId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<{ instanceId: string; hostUserId: string }> {
    return this.instanceService.createInstance(params);
  }

  async joinInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    return this.instanceService.joinInstance(instanceId, user);
  }

  async startInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    return this.instanceService.startInstance(instanceId, user);
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — controller-facing wrapper for
   * `InstanceService.startCountdown`. Translates the
   * `InstanceCountdownAlreadyStartedError` into a 200 idempotent
   * response: when the host double-clicks, the controller surfaces
   * the existing countdown anchor rather than a 409.
   *
   * Idempotency keys are honored at the controller layer (see
   * `InstanceController.startCountdown`). The application service is
   * intentionally simple: it either transitions the row or folds a
   * `COUNTDOWN_ALREADY_STARTED` error into the existing anchor.
   */
  async startCountdownForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<StartCountdownResponseDto> {
    try {
      const result = await this.instanceService.startCountdown(instanceId, user);
      return {
        instanceId: result.instanceId,
        status: result.status,
        countdownStartedAt: result.countdownStartedAt,
        countdownEndsAt: result.countdownEndsAt,
      };
    } catch (error) {
      if (error instanceof InstanceCountdownAlreadyStartedError) {
        // Idempotent retry — return the existing countdown anchor so
        // the host's double-click is a no-op rather than an error.
        const instance = await this.instanceService.getInstanceById(instanceId);
        if (instance.status === 'countdown' && instance.countdownStartedAt) {
          const endsAt = new Date(
            new Date(instance.countdownStartedAt).getTime() + InstanceService.COUNTDOWN_DURATION_MS,
          ).toISOString();
          return {
            instanceId,
            status: 'countdown',
            countdownStartedAt: instance.countdownStartedAt,
            countdownEndsAt: endsAt,
          };
        }
      }
      throw error;
    }
  }

  async cancelCountdownForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<{ message: string }> {
    return this.instanceService.cancelCountdown(instanceId, user, 'host_cancelled');
  }

  /**
   * Phase 2 (Gameplay Lifecycle) — controller-facing breadcrumb for the
   * optional `idempotencyKey` field on `POST /instances/:id/countdown`.
   *
   * The key is honored as a structured log entry; the durable dedup
   * claim is added in a follow-up that depends on the review module's
   * `IdempotencyService`. Until then the natural idempotency
   * (`status === 'countdown'` short-circuits to a 200) is the only
   * safety net, and this log line gives observability into clients
   * that want strict per-request dedup.
   */
  logCountdownIdempotencyKey(params: {
    instanceId: string;
    userId: string;
    idempotencyKey: string;
  }): void {
    this.logger.debug({
      event: 'instance_countdown_idempotency_key_seen',
      instanceId: params.instanceId,
      userId: params.userId,
      keyPrefix: params.idempotencyKey.slice(0, 12),
    });
  }

  // ─── HTTP-shaped methods (used by the REST controller) ────────────────────
  //
  // These return the response DTOs that the controller previously constructed
  // inline. Moving the projection here lets the controller stay thin and the
  // presenter emit the canonical `{ data, meta }` envelope.

  async createInstanceForController(params: {
    quizId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<CreateInstanceResponseDto> {
    const result = await this.instanceService.createInstance(params);
    return {
      instanceId: result.instanceId,
      message: 'Instance created successfully',
    };
  }

  async joinInstanceForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<JoinInstanceResponseDto> {
    const result = await this.instanceService.joinInstance(instanceId, user);
    return result;
  }

  async startInstanceForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<StartInstanceResponseDto> {
    const result = await this.instanceService.startInstance(instanceId, user);
    return result;
  }

  async closeInstanceForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<CloseInstanceResponseDto> {
    return this.instanceService.closeInstance(instanceId, user);
  }

  async getInstanceByIdForController(instanceId: string): Promise<InstanceDetailResponseDto> {
    const row = await this.instanceService.getInstanceById(instanceId);
    const { items: players } = await this.instanceService.listInstancePlayers(instanceId);
    return this.mapper.toInstanceDetailResponse(
      row,
      players.map((p) => this.mapper.toInstancePlayerResponse(p)),
    );
  }

  async listInstancesForController(params: {
    limit: number;
    cursor?: string | null;
    filters?: {
      status?: string;
      difficulty?: string;
      quizId?: string;
      creatorId?: string;
    };
  }): Promise<InstanceListResponseDto> {
    const result = await this.instanceService.listInstances(params);
    return {
      items: result.rows.map((row) => this.mapper.toInstanceListItemResponse(row)),
      pagination: {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,
      },
    };
  }

  async listInstancePlayersForController(instanceId: string): Promise<InstancePlayersResponseDto> {
    const { items, total } = await this.instanceService.listInstancePlayers(instanceId);
    return {
      instanceId,
      items: items.map((p) => this.mapper.toInstancePlayerResponse(p)),
      total,
    };
  }

  async getLeaderboardForController(params: {
    instanceId: string;
    limit: number;
    cursor?: LeaderboardCursorPayload | null;
  }): Promise<InstanceLeaderboardResponseDto> {
    const { items, hasNextPage } = await this.instanceService.getLeaderboard(params);

    const lastItem = items.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({
              rank: lastItem.rank,
              instancePlayerId: lastItem.instancePlayerId,
            }),
            'utf8',
          ).toString('base64url')
        : null;

    return {
      items: items.map((entry) => this.mapper.toLeaderboardEntryResponse(entry)),
      pagination: {
        limit: params.limit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * Called by the gateway when a player joins an instance.
   * Registers the socket in the cross-instance
   * `SocketConnectionRegistry` so that the disconnect hot path on
   * any replica can still resolve `{ instanceId, userId }` from the
   * socket id.
   *
   * Phase 3: previously held a process-local Map; under
   * horizontal scaling that Map only saw sockets that joined on
   * the current replica, so cross-instance disconnects silently
   * dropped `PlayerDisconnectedEvent`. The Redis-backed registry
   * fixes that without changing the call surface.
   */
  handlePlayerJoinedSocket(params: {
    socketId: string;
    instanceId: string;
    user: JwtPayload;
  }): void {
    if (!params.user?.sub) {
      this.logger.warn({
        event: 'socket_connection_registry_join_refused',
        reason: 'missing_jwt_sub',
        socketId: params.socketId,
        instanceId: params.instanceId,
      });
      return;
    }

    void this.socketConnectionRegistry.record(params.socketId, {
      instanceId: params.instanceId,
      userId: params.user.sub,
    });
  }

  /**
   * Called by the gateway on disconnect.
   *
   * Atomically reads-and-deletes the metadata for the given socket
   * id from the cross-instance registry. If a prior replica, a
   * dropped TCP segment, or a stale `disconnect` event already
   * consumed the entry, the call returns `null` and we emit no
   * event — that is correct: the same disconnect must not surface
   * twice.
   */
  async handlePlayerLeftSocket(params: { socketId: string; instanceId: string }): Promise<void> {
    const meta = await this.socketConnectionRegistry.consume(params.socketId);
    if (!meta) return;

    const nowIso = new Date().toISOString();
    this.eventBus.emitPlayerDisconnected(
      new PlayerDisconnectedEvent(meta.instanceId, meta.userId, params.socketId, nowIso),
    );

    void this.notifyHostPlayerDisconnected(meta.instanceId, meta.userId);
  }

  private async notifyHostPlayerDisconnected(
    instanceId: string,
    leavingUserId: string,
  ): Promise<void> {
    try {
      const instance = await this.instanceService.getInstanceById(instanceId);
      const totalPlayers = await this.instanceService.getInstancePlayers(instanceId);
      await this.instanceService.notifyHostPlayerDisconnected({
        instanceId,
        hostUserId: instance.hostUserId,
        leavingUserId,
        totalPlayers: totalPlayers.length,
      });
    } catch {
      // Non-fatal: host notification failure must not affect the disconnect flow
    }
  }

  async handleJoinInstanceSocket(
    instanceId: string,
    _user: JwtPayload,
  ): Promise<{ status: string; quizTitle: string }> {
    const instance = await this.instanceService.getInstanceById(instanceId);
    return { status: instance.status, quizTitle: instance.quizTitle };
  }

  async handleStartGameSocket(instanceId: string, user: JwtPayload): Promise<boolean> {
    return this.instanceService.isHost(instanceId, user.sub);
  }

  async handleQuestionRevealedSocket(
    data: { instanceId: string; questionNumber: number; totalQuestions: number },
    user: JwtPayload,
  ): Promise<boolean> {
    return this.instanceService.isHost(data.instanceId, user.sub);
  }

  async handleUpdateLeaderboardSocket(instanceId: string, user: JwtPayload): Promise<boolean> {
    return this.instanceService.isHost(instanceId, user.sub);
  }

  async handleEndGameSocket(instanceId: string, user: JwtPayload): Promise<boolean> {
    return this.instanceService.isHost(instanceId, user.sub);
  }

  private emitToRoom(room: string, event: string, data: Record<string, unknown>): void {
    this.server?.to(room).emit(event, data);
  }

  private onInstanceCreated(event: InstanceCreatedEvent): void {
    this.logger.debug({
      event: 'socket_instance_created',
      instanceId: event.instanceId,
    });
  }

  private onPlayerJoined(event: PlayerJoinedEvent): void {
    this.emitToRoom(event.instanceId, 'player_joined', {
      userId: event.userId,
      totalPlayers: event.totalPlayers,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onPlayerAttemptStarted(event: PlayerAttemptStartedEvent): void {
    this.emitToRoom(event.instanceId, 'player_attempt_started', {
      userId: event.userId,
      attemptId: event.attemptId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onPlayerXpEarned(event: PlayerXpEarnedEvent): void {
    this.emitToRoom(event.instanceId, 'xp_earned', {
      userId: event.userId,
      xpEarned: event.xpEarned,
      newAllTimeXp: event.newAllTimeXp,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onPlayerFinished(event: PlayerFinishedEvent): void {
    this.emitToRoom(event.instanceId, 'player_finished', {
      userId: event.userId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onPlayerDisconnected(event: PlayerDisconnectedEvent): void {
    this.emitToRoom(event.instanceId, 'player_left', {
      socketId: event.socketId,
      userId: event.userId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onInstanceStarted(event: InstanceStartedEvent): void {
    this.emitToRoom(event.instanceId, 'game_started', {
      instanceId: event.instanceId,
      startedBy: event.hostUserId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onInstanceClosed(event: InstanceClosedEvent): void {
    this.emitToRoom(event.instanceId, 'game_finished', {
      instanceId: event.instanceId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onCountdownStarted(event: CountdownStartedEvent): void {
    this.emitToRoom(event.instanceId, 'countdown_started', {
      instanceId: event.instanceId,
      startedBy: event.hostUserId,
      countdownStartedAt: event.countdownStartedAt,
      countdownEndsAt: event.countdownEndsAt,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onCountdownCancelled(event: CountdownCancelledEvent): void {
    this.emitToRoom(event.instanceId, 'countdown_cancelled', {
      instanceId: event.instanceId,
      cancelledBy: event.hostUserId,
      reason: event.reason,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onCountdownCompleted(event: CountdownCompletedEvent): void {
    this.emitToRoom(event.instanceId, 'countdown_completed', {
      instanceId: event.instanceId,
      startedAt: event.startedAt,
      timestamp: event.timestamp.toISOString(),
    });
  }
}
