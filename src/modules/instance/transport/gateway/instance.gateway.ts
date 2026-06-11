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
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '../filters/ws-exception.filter';
import { InstanceApplicationService } from '../../application/instance.application.service';

const ERR_NOT_HOST = { code: 'NOT_HOST', message: 'Only the host can perform this action' };
const ERR_FORBIDDEN = { code: 'FORBIDDEN', message: 'You do not have permission for this action' };

@WebSocketGateway({
  namespace: '/instances',
  cors: {
    origin: '*',
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
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

  handleConnection(client: Socket): void {
    this.logger.info({ event: 'client_connected', socketId: client.id });
  }

  handleDisconnect(client: Socket): void {
    this.logger.info({ event: 'client_disconnected', socketId: client.id });

    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    for (const roomId of rooms) {
      void client.leave(roomId);
      this.instanceAppService.handlePlayerLeftSocket({ socketId: client.id, instanceId: roomId });
    }
  }

  @UseGuards(WsJwtGuard)
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const { instanceId } = data;

    const isHost = await this.instanceAppService.handleStartGameSocket(instanceId, user);
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

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('answer_submitted')
  handleAnswerSubmitted(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { instanceId: string; questionId: string; selectedOptionId: string; timeTakenMs: number },
    @WsCurrentUser() user: JwtPayload,
  ): { event: string; data: Record<string, unknown> } {
    this.logger.info({
      event: 'ws_answer_submitted',
      instanceId: data.instanceId,
      userId: user.sub,
      questionId: data.questionId,
    });

    return {
      event: 'ack',
      data: {
        questionId: data.questionId,
        received: true,
      },
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('question_revealed')
  async handleQuestionRevealed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string; questionNumber: number; totalQuestions: number },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.instanceAppService.handleQuestionRevealedSocket(data, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    this.server.to(data.instanceId).emit('question_revealed', {
      questionNumber: data.questionNumber,
      totalQuestions: data.totalQuestions,
      timestamp: new Date().toISOString(),
    });

    return { event: 'ack', data: { received: true } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('update_leaderboard')
  async handleUpdateLeaderboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.instanceAppService.handleUpdateLeaderboardSocket(data.instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    return { event: 'ack', data: { received: true } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('end_game')
  async handleEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
    const isHost = await this.instanceAppService.handleEndGameSocket(data.instanceId, user);
    if (!isHost) {
      return { event: 'error', data: ERR_NOT_HOST };
    }

    return { event: 'ack', data: { received: true } };
  }
}
