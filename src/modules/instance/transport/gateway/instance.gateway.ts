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
import { UseGuards, UseFilters } from '@nestjs/common';
import { WsJwtGuard } from '@/common/guards/ws-jwt.guard';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { InstanceService } from '../../domain/instance.service';
import { WsExceptionFilter } from '../filters/ws-exception.filter';

interface RoomState {
  socketToUser: Map<string, string>;
}

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
  server: Server = new Server();

  private roomStates: Map<string, RoomState> = new Map();

  constructor(private readonly instanceService: InstanceService) {}

  handleConnection(client: Socket): void {
    this.logger.info({ event: 'client_connected', socketId: client.id });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.info({ event: 'client_disconnected', socketId: client.id });

    for (const [roomId, room] of this.roomStates.entries()) {
      if (room.socketToUser.has(client.id)) {
        room.socketToUser.delete(client.id);
        client.leave(roomId);
        this.server.to(roomId).emit('player_left', {
          socketId: client.id,
          remainingPlayers: room.socketToUser.size,
        });

        if (room.socketToUser.size === 0) {
          this.roomStates.delete(roomId);
        }
        break;
      }
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

    const instance = await this.instanceService.getInstanceById(instanceId);

    client.join(instanceId);

    if (!this.roomStates.has(instanceId)) {
      this.roomStates.set(instanceId, { socketToUser: new Map() });
    }

    this.roomStates.get(instanceId)!.socketToUser.set(client.id, user.sub);

    this.server.to(instanceId).emit('player_joined', {
      userId: user.sub,
      username: user.sub,
      totalPlayers: this.roomStates.get(instanceId)!.socketToUser.size,
      instanceStatus: instance.status,
    });

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
        status: instance.status,
        quizTitle: instance.quizTitle,
      },
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> } | void> {
    const { instanceId } = data;

    const isHost = await this.instanceService.isHost(instanceId, user.sub);
    if (!isHost) return;

    const result = await this.instanceService.startInstance(instanceId, user);

    this.server.to(instanceId).emit('game_started', {
      instanceId,
      startedBy: user.sub,
      timestamp: new Date().toISOString(),
    });

    this.logger.info({
      event: 'ws_game_started',
      instanceId,
      userId: user.sub,
    });

    return { event: 'ack', data: result };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('answer_submitted')
  async handleAnswerSubmitted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string; questionId: string; selectedOptionId: string; timeTakenMs: number },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<{ event: string; data: Record<string, unknown> }> {
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
  ): Promise<void> {
    const isHost = await this.instanceService.isHost(data.instanceId, user.sub);
    if (!isHost) return;

    this.server.to(data.instanceId).emit('question_revealed', {
      questionNumber: data.questionNumber,
      totalQuestions: data.totalQuestions,
      timestamp: new Date().toISOString(),
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('update_leaderboard')
  async handleUpdateLeaderboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<void> {
    const isHost = await this.instanceService.isHost(data.instanceId, user.sub);
    if (!isHost) return;

    const leaderboard = await this.instanceService.getLeaderboard(data.instanceId);

    this.server.to(data.instanceId).emit('leaderboard_updated', {
      entries: leaderboard.map((e) => ({
        userId: e.userId,
        username: e.username,
        displayName: e.displayName,
        avatarUrl: e.avatarUrl,
        scorePercent: e.scorePercent,
        correctCount: e.correctCount,
        timeTakenMs: e.timeTakenMs,
        rank: e.rank,
        status: e.status,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('end_game')
  async handleEndGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { instanceId: string },
    @WsCurrentUser() user: JwtPayload,
  ): Promise<void> {
    const isHost = await this.instanceService.isHost(data.instanceId, user.sub);
    if (!isHost) return;

    const leaderboard = await this.instanceService.getLeaderboard(data.instanceId);

    this.server.to(data.instanceId).emit('game_finished', {
      instanceId: data.instanceId,
      leaderboard: leaderboard.map((e) => ({
        userId: e.userId,
        username: e.username,
        displayName: e.displayName,
        avatarUrl: e.avatarUrl,
        scorePercent: e.scorePercent,
        correctCount: e.correctCount,
        timeTakenMs: e.timeTakenMs,
        rank: e.rank,
        status: e.status,
      })),
      timestamp: new Date().toISOString(),
    });

    this.logger.info({
      event: 'ws_game_finished',
      instanceId: data.instanceId,
      userId: user.sub,
    });
  }

  private get logger() {
    return {
      info: (obj: Record<string, unknown>) => {
        console.log(JSON.stringify({ ...obj, source: 'InstanceGateway' }));
      },
    };
  }
}
