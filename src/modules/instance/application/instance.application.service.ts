import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { InstanceService } from '../domain/instance.service';
import { INSTANCE_DOMAIN_EVENT_BUS } from '../domain/events';
import type { InstanceDomainEventBusPort } from '../domain/events';
import {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  PlayerAttemptStartedEvent,
  PlayerXpEarnedEvent,
  PlayerFinishedEvent,
  PlayerDisconnectedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
} from '../domain/events';
import type { Server } from 'socket.io';

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
 *                                                               ↘ Socket.IO server
 */
@Injectable()
export class InstanceApplicationService {
  private server: Server | null = null;

  /**
   * Maps socket ID → { instanceId, userId } for active connections.
   * Used to emit PlayerDisconnectedEvent when a socket disconnects.
   */
  private readonly socketIdToMeta = new Map<string, { instanceId: string; userId: string }>();

  constructor(
    private readonly instanceService: InstanceService,
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly eventBus: InstanceDomainEventBusPort,
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
      }
    });
  }

  async createInstance(params: {
    quizVersionId: string;
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
   * Called by the gateway when a player joins an instance.
   * Registers the socket so handlePlayerLeftSocket can emit PlayerDisconnectedEvent on disconnect.
   */
  handlePlayerJoinedSocket(params: {
    socketId: string;
    instanceId: string;
    user: JwtPayload;
  }): void {
    this.socketIdToMeta.set(params.socketId, {
      instanceId: params.instanceId,
      userId: params.user.sub,
    });
  }

  /**
   * Called by the gateway on disconnect.
   * Removes the socket from tracking, emits PlayerDisconnectedEvent, and notifies the host.
   */
  async handlePlayerLeftSocket(params: { socketId: string; instanceId: string }): Promise<void> {
    const meta = this.socketIdToMeta.get(params.socketId);
    if (!meta) return;

    this.socketIdToMeta.delete(params.socketId);

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
    user: JwtPayload,
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
}
