import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseFilters, UseGuards } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsJwtGuard, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { WsThrottlerGuard } from '@/common/guards/ws-throttler.guard';
import { WsThrottle } from '@/common/decorators/ws-throttle.decorator';
import { WS_RATE_LIMITS } from '@/common/ws/ws-rate-limits';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '../filters/ws-exception.filter';
import { resolveWsCorsOrigins } from '@/common/utils/ws-cors.util';
import { InstanceApplicationService } from '../../application/instance.application.service';
const ERR_NOT_HOST = { code: 'NOT_HOST', message: 'Only the host can perform this action' };
const ERR_FORBIDDEN = { code: 'FORBIDDEN', message: 'You do not have permission for this action' };

@WebSocketGateway({
  namespace: '/instances',
  cors: {
    origin: resolveWsCorsOrigins(),
    credentials: false,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard, WsThrottlerGuard)
export class InstanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly instanceAppService: InstanceApplicationService,
    @InjectPinoLogger(InstanceGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  afterInit(): void {
    this.instanceAppService.setServer(this.server);
  }

  private async isHostCached(
    client: Socket,
    instanceId: string,
    user: JwtPayload,
  ): Promise<boolean> {
    const cached = (client.data.hostInstances ?? {})[instanceId];
    if (typeof cached === 'boolean') return cached;
    const fresh = await this.instanceAppService.handleStartGameSocket(instanceId, user);
    client.data.hostInstances = {
      ...(client.data.hostInstances ?? {}),
      [instanceId]: fresh,
    };
    return fresh;
  }

  handleConnection(client: Socket): void {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.user;
    if (!user?.sub) {
      this.logger.info({
        event: 'ws_unauth_disconnect',
        socketId: client.id,
      });
      client.disconnect(true);
      return;
    }

    this.logger.info({ event: 'client_connected', socketId: client.id, userId: user.sub });
  }

  handleDisconnect(client: Socket): void {
    this.logger.info({ event: 'client_disconnected', socketId: client.id });

    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    void Promise.allSettled(
      rooms.map((roomId) =>
        Promise.allSettled([
          client.leave(roomId),
          this.instanceAppService.handlePlayerLeftSocket({
            socketId: client.id,
            instanceId: roomId,
          }),
        ]),
      ),
    ).then((settled) => {
      const rejected = settled.flatMap((entry) =>
        entry.status === 'rejected' ? [entry.reason] : [],
      );
      if (rejected.length > 0) {
        this.logger.warn({
          event: 'instance_disconnect_cleanup_partial_failure',
          socketId: client.id,
          failed: rejected.length,
          error: rejected.map((r) => (r instanceof Error ? r.message : String(r))).join('; '),
        });
      }
    });
  }

  @WsThrottle(WS_RATE_LIMITS.instanceJoin)
  @SubscribeMessage('join_instance')
  async handleJoinInstance(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const { instanceId } = data;

    await client.join(instanceId);
    this.instanceAppService.handlePlayerJoinedSocket({ socketId: client.id, instanceId, user });

    await this.instanceAppService.joinInstance(instanceId, user);

    const result = await this.instanceAppService.handleJoinInstanceSocket(instanceId, user);
    const isHost = await this.instanceAppService.handleStartGameSocket(instanceId, user);
    client.data.hostInstances = {
      ...(client.data.hostInstances ?? {}),
      [instanceId]: isHost,
    };

    this.logger.info({
      event: 'ws_player_joined',
      instanceId,
      userId: user.sub,
      socketId: client.id,
    });

    return {
      event: 'joined',
      data: {
        instanceId,
        status: result.status,
        quizTitle: result.quizTitle,
      },
    };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceStartGame)
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const { instanceId } = data;

    const isHost = await this.isHostCached(client, instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_FORBIDDEN };
    }

    const result = await this.instanceAppService.startInstance(instanceId, user);

    this.logger.info({
      event: 'ws_game_started',
      instanceId,
      userId: user.sub,
    });

    return { event: 'ack', data: result };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceStartCountdown)
  @SubscribeMessage('start_countdown')
  async handleStartCountdown(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const { instanceId } = data;

    const isHost = await this.isHostCached(client, instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_FORBIDDEN };
    }

    const result = await this.instanceAppService.startCountdownForController(instanceId, user);

    this.logger.info({
      event: 'ws_countdown_started',
      instanceId,
      userId: user.sub,
    });

    return {
      event: 'ack',
      data: { ...result, instanceId },
    };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceCancelCountdown)
  @SubscribeMessage('cancel_countdown')
  async handleCancelCountdown(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const { instanceId } = data;

    const isHost = await this.isHostCached(client, instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_FORBIDDEN };
    }

    const result = await this.instanceAppService.cancelCountdownForController(instanceId, user);

    this.logger.info({
      event: 'ws_countdown_cancelled',
      instanceId,
      userId: user.sub,
    });

    return {
      event: 'ack',
      data: { ...result, instanceId },
    };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceAnswerSubmitted)
  @SubscribeMessage('answer_submitted')
  async handleAnswerSubmitted(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      instanceId: string;
      questionId: string;
      selectedOptionId: string | null;
      timeTakenMs: number;
    },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const result = await this.instanceAppService.handleAnswerSubmittedSocket(data, user);

    if (!result.accepted) {
      this.logger.warn({
        event: 'ws_answer_rejected',
        instanceId: data.instanceId,
        userId: user.sub,
        reason: result.reason,
        questionId: data.questionId,
      });
      return {
        event: 'error',
        data: { code: result.reason ?? 'REJECTED', message: 'Answer not accepted' },
      };
    }

    this.logger.info({
      event: 'ws_answer_submitted',
      instanceId: data.instanceId,
      userId: user.sub,
      attemptId: result.attemptId,
      questionId: data.questionId,
    });

    return {
      event: 'ack',
      data: {
        questionId: data.questionId,
        attemptId: result.attemptId,
        received: true,
      },
    };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceQuestionRevealed)
  @SubscribeMessage('question_revealed')
  async handleQuestionRevealed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string; questionNumber: number; totalQuestions: number },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.isHostCached(client, data.instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    this.server.to(data.instanceId).emit(
      'question_revealed',
      {
        questionNumber: data.questionNumber,
        totalQuestions: data.totalQuestions,
        timestamp: new Date().toISOString(),
      },
      (ack: unknown) => {
        if (ack === undefined) return;
        this.logger.debug({
          event: 'ws_question_revealed_acked',
          instanceId: data.instanceId,
          socketId: client.id,
        });
      },
    );

    return { event: 'ack', data: { received: true } };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceUpdateLeaderboard)
  @SubscribeMessage('update_leaderboard')
  async handleUpdateLeaderboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.isHostCached(client, data.instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    return { event: 'ack', data: { received: true } };
  }

  @WsThrottle(WS_RATE_LIMITS.instanceEndGame)
  @SubscribeMessage('end_game')
  async handleEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.isHostCached(client, data.instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    return { event: 'ack', data: { received: true } };
  }
}
