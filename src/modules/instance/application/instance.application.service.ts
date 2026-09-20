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
import { InstanceCountdownAlreadyStartedError } from '../domain/errors';
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
    // The detail view embeds the full players list. Instance capacity
    // is capped at 100 by `CreateInstanceDto.maxPlayers`, so a single
    // over-sized page is safe. If the cap changes, switch to paginated
    // assembly here.
    const { items: players } = await this.instanceService.listInstancePlayers(instanceId, {
      limit: 100,
    });
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

  async handlePlayerLeftSocket(params: { socketId: string; instanceId: string }): Promise<void> {
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
      return;
    }
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
      const totalPlayers = await this.instanceService.countPlayers(instanceId);
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
    this.emitToRoom(event.instanceId, 'player_left', {
      socketId: event.socketId,
      userId: event.userId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private onPlayerAnswered(event: PlayerAnsweredEvent): void {
    this.emitToRoom(event.instanceId, 'player_answered', {
      userId: event.userId,
      attemptId: event.attemptId,
      questionId: event.questionId,
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
