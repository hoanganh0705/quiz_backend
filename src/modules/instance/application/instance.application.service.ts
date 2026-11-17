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
  PlayerAnsweredEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
  CountdownStartedEvent,
  CountdownCancelledEvent,
  CountdownCompletedEvent,
} from '../domain/events';
import {
  InstanceCountdownAlreadyStartedError,
  InstanceAlreadyStartedError,
} from '../domain/errors';
import type { Server } from 'socket.io';
import { InstanceResponseMapper } from '../mappers/instance-response.mapper';
import type { LeaderboardCursorPayload } from '../domain/ports';
import { AttemptApplicationService } from '@/modules/attempt/application/attempt.application.service';
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
    private readonly attemptApplicationService: AttemptApplicationService,
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
      } else if (event instanceof PlayerAnsweredEvent) {
        this.onPlayerAnswered(event);
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
    try {
      const result = await this.instanceService.startInstance(instanceId, user);
      return result;
    } catch (error) {
      if (error instanceof InstanceAlreadyStartedError) {
        return { message: 'Instance already started' };
      }
      throw error;
    }
  }

  async closeInstanceForController(
    instanceId: string,
    user: JwtPayload,
  ): Promise<CloseInstanceResponseDto> {
    return this.instanceService.closeInstance(instanceId, user);
  }

  async getInstanceByIdForController(instanceId: string): Promise<InstanceDetailResponseDto> {
    const [row, playersPage] = await Promise.all([
      this.instanceService.getInstanceById(instanceId),
      this.instanceService.listInstancePlayers(instanceId, { limit: 100 }),
    ]);
    return this.mapper.toInstanceDetailResponse(
      row,
      playersPage.items.map((p) => this.mapper.toInstancePlayerResponse(p)),
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
      items: result.rows.map((row) => {
        let activeCount: number | undefined;
        if (this.server) {
          const instanceNamespace =
            typeof this.server.of === 'function' ? this.server.of('/instances') : null;
          const adapter = instanceNamespace?.adapter ?? this.server.sockets?.adapter;
          if (adapter?.rooms) {
            const room = adapter.rooms.get(row.instanceId);
            activeCount = room ? room.size : 0;
          }
        }
        return this.mapper.toInstanceListItemResponse(row, activeCount);
      }),
      pagination: {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,
      },
    };
  }

  async listInstancePlayersForController(params: {
    instanceId: string;
    limit: number;
    cursor?: { joinedAt: string; instancePlayerId: string } | null;
  }): Promise<InstancePlayersResponseDto> {
    const { items, hasNextPage, nextCursor } = await this.instanceService.listInstancePlayers(
      params.instanceId,
      { limit: params.limit, cursor: params.cursor ?? null },
    );
    return {
      items: items.map((p) => this.mapper.toInstancePlayerResponse(p)),
      pagination: {
        limit: params.limit,
        hasNextPage,
        nextCursor,
      },
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

  async handlePlayerLeftSocket(params: {
    socketId: string;
    instanceId: string;
    userId?: string;
  }): Promise<void> {
    let meta: { instanceId: string; userId: string } | null = null;
    try {
      meta = await this.socketConnectionRegistry.consume(params.socketId);
    } catch (error) {
      this.logger.error({
        event: 'socket_consume_failed',
        socketId: params.socketId,
        instanceId: params.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const effectiveInstanceId = meta?.instanceId || params.instanceId;
    const effectiveUserId = meta?.userId || params.userId;
    if (!effectiveInstanceId || !effectiveUserId) return;

    const nowIso = new Date().toISOString();

    try {
      await this.instanceService.leaveInstancePlayer({
        instanceId: effectiveInstanceId,
        userId: effectiveUserId,
      });
    } catch (err) {
      this.logger.warn({
        event: 'instance_player_disconnect_db_update_failed',
        instanceId: effectiveInstanceId,
        userId: effectiveUserId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.eventBus.emitPlayerDisconnected(
      new PlayerDisconnectedEvent(effectiveInstanceId, effectiveUserId, params.socketId, nowIso),
    );

    void this.notifyHostPlayerDisconnected(effectiveInstanceId, effectiveUserId);
  }

  private async notifyHostPlayerDisconnected(
    instanceId: string,
    leavingUserId: string,
  ): Promise<void> {
    try {
      const [instance, totalPlayers] = await Promise.all([
        this.instanceService.getInstanceById(instanceId),
        this.instanceService.countPlayers(instanceId),
      ]);
      await this.instanceService.notifyHostPlayerDisconnected({
        instanceId,
        hostUserId: instance.hostUserId,
        leavingUserId,
        totalPlayers,
      });
    } catch {
      void this.logger.debug({
        event: 'instance_host_disconnect_notify_failed',
        instanceId,
        leavingUserId,
      });
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

  async handleAnswerSubmittedSocket(
    data: {
      instanceId: string;
      questionId: string;
      selectedOptionId: string | null;
      timeTakenMs: number;
    },
    user: JwtPayload,
  ): Promise<{
    accepted: boolean;
    reason?: string;
    attemptId: string;
  }> {
    const player = await this.instanceService.getPlayerByUserAndInstance({
      instanceId: data.instanceId,
      userId: user.sub,
    });

    if (!player) {
      return { accepted: false, reason: 'NOT_IN_INSTANCE', attemptId: '' };
    }

    if (!player.attemptId) {
      return { accepted: false, reason: 'ATTEMPT_NOT_READY', attemptId: '' };
    }

    const instance = await this.instanceService.getInstanceById(data.instanceId);
    if (instance.status !== 'running') {
      return { accepted: false, reason: 'INSTANCE_NOT_RUNNING', attemptId: player.attemptId };
    }

    await this.attemptApplicationService.submitAnswer(
      player.attemptId,
      data.questionId,
      data.selectedOptionId,
      data.timeTakenMs,
      user,
    );

    const nowIso = new Date().toISOString();
    this.eventBus.emitPlayerAnswered(
      new PlayerAnsweredEvent(
        data.instanceId,
        user.sub,
        player.attemptId,
        data.questionId,
        data.selectedOptionId,
        data.timeTakenMs,
        null,
        nowIso,
      ),
    );

    return {
      accepted: true,
      attemptId: player.attemptId,
    };
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
    const at = event.timestamp.toISOString();
    this.emitToRoom(event.instanceId, 'player_left', {
      instanceId: event.instanceId,
      socketId: event.socketId,
      userId: event.userId,
      playerId: event.userId,
      eventSequence: Date.now(),
      timestamp: at,
      at,
    });
  }

  private onPlayerAnswered(event: PlayerAnsweredEvent): void {
    const at = event.timestamp.toISOString();
    this.emitToRoom(event.instanceId, 'player_answered', {
      instanceId: event.instanceId,
      userId: event.userId,
      attemptId: event.attemptId,
      questionId: event.questionId,
      eventSequence: Date.now(),
      timestamp: at,
      at,
    });
  }

  private onInstanceStarted(event: InstanceStartedEvent): void {
    const at = event.timestamp.toISOString();
    const payload = {
      instanceId: event.instanceId,
      startedBy: event.hostUserId,
      eventSequence: Date.now(),
      timestamp: at,
      at,
      status: 'running',
    };
    this.emitToRoom(event.instanceId, 'game_started', payload);
    this.emitToRoom(event.instanceId, 'instance:started', payload);
    this.emitToRoom(event.instanceId, 'instance_started', payload);
  }

  private onInstanceClosed(event: InstanceClosedEvent): void {
    const at = event.timestamp.toISOString();
    const payload = {
      instanceId: event.instanceId,
      eventSequence: Date.now(),
      timestamp: at,
      at,
      status: 'closed',
    };
    this.emitToRoom(event.instanceId, 'game_finished', payload);
    this.emitToRoom(event.instanceId, 'instance:closed', payload);
    this.emitToRoom(event.instanceId, 'instance_closed', payload);
  }

  private onCountdownStarted(event: CountdownStartedEvent): void {
    const at = event.timestamp.toISOString();
    const payload = {
      instanceId: event.instanceId,
      startedBy: event.hostUserId,
      countdownStartedAt: event.countdownStartedAt,
      countdownEndsAt: event.countdownEndsAt,
      eventSequence: Date.now(),
      timestamp: at,
      at,
      status: 'countdown',
    };
    this.emitToRoom(event.instanceId, 'countdown_started', payload);
    this.emitToRoom(event.instanceId, 'countdown:started', payload);
  }

  private onCountdownCancelled(event: CountdownCancelledEvent): void {
    const at = event.timestamp.toISOString();
    const payload = {
      instanceId: event.instanceId,
      cancelledBy: event.hostUserId,
      reason: event.reason,
      eventSequence: Date.now(),
      timestamp: at,
      at,
      status: 'open',
    };
    this.emitToRoom(event.instanceId, 'countdown_cancelled', payload);
    this.emitToRoom(event.instanceId, 'countdown:cancelled', payload);
  }

  private onCountdownCompleted(event: CountdownCompletedEvent): void {
    const at = event.timestamp.toISOString();
    const payload = {
      instanceId: event.instanceId,
      startedAt: event.startedAt,
      eventSequence: Date.now(),
      timestamp: at,
      at,
      status: 'running',
    };
    this.emitToRoom(event.instanceId, 'countdown_completed', payload);
    this.emitToRoom(event.instanceId, 'countdown:completed', payload);
    this.emitToRoom(event.instanceId, 'instance:started', payload);
    this.emitToRoom(event.instanceId, 'game_started', payload);
    this.emitToRoom(event.instanceId, 'instance_started', payload);
  }
}
