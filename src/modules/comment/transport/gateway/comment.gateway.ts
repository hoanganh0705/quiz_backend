/**
 * Comment Gateway
 *
 * Real-time WebSocket gateway for delivering comment lifecycle events
 * (created, edited, deleted, voted) to connected clients.
 *
 * Clients connect with a JWT token via handshake auth.
 * On connect, the client joins a user-scoped room `user:{userId}` for personal events.
 * Clients also join quiz-scoped rooms `quiz:{quizId}` to receive comment events
 * for quizzes they are viewing.
 *
 * When comment events are published via CommentDomainEventBus, this gateway
 * broadcasts them to all connected sockets subscribed to the relevant quiz room.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket, RemoteSocket } from 'socket.io';
import { UseFilters, UseGuards } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsJwtGuard, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '@/modules/instance/transport/filters/ws-exception.filter';
import type { CommentDomainEvent } from '@/modules/comment/domain/events';

const NAMESPACE = '/comments';
const USER_ROOM_PREFIX = 'user:';
const QUIZ_ROOM_PREFIX = 'quiz:';

const getCorsOrigins = (): string | string[] => {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : '*';
};

@WebSocketGateway({
  namespace: NAMESPACE,
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class CommentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(CommentGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  handleConnection(client: Socket): void {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.user;
    if (!user?.sub) return;

    const userId = user.sub;
    void client.join(`${USER_ROOM_PREFIX}${userId}`);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.info({
      event: 'comment_gateway_client_connected',
      socketId: client.id,
      userId,
    });
  }

  handleDisconnect(client: Socket): void {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.user;
    if (!user?.sub) return;

    const userId = user.sub;
    void client.leave(`${USER_ROOM_PREFIX}${userId}`);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.info({
      event: 'comment_gateway_client_disconnected',
      socketId: client.id,
      userId,
    });
  }

  /**
   * Subscribe to a quiz's comment stream.
   * The client joins the quiz-scoped room to receive all comment events
   * for that quiz.
   */
  @SubscribeMessage('subscribe_quiz')
  handleSubscribeQuiz(
    @ConnectedSocket() client: Socket,
    @WsCurrentUser() _user: JwtPayload,
    @MessageBody() data: { quizId: string },
  ): { event: 'subscribed'; type: 'quiz'; quizId: string } {
    const quizId = data?.quizId;
    if (!quizId || typeof quizId !== 'string') {
      this.logger.warn({
        event: 'comment_gateway_invalid_subscribe',
        socketId: client.id,
        reason: 'invalid_quiz_id',
      });
      return { event: 'subscribed', type: 'quiz', quizId: '' };
    }

    void client.join(`${QUIZ_ROOM_PREFIX}${quizId}`);

    this.logger.debug({
      event: 'comment_gateway_client_subscribed_quiz',
      socketId: client.id,
      quizId,
    });

    return { event: 'subscribed', type: 'quiz', quizId };
  }

  /**
   * Unsubscribe from a quiz's comment stream.
   */
  @SubscribeMessage('unsubscribe_quiz')
  handleUnsubscribeQuiz(
    @ConnectedSocket() client: Socket,
    @WsCurrentUser() _user: JwtPayload,
    @MessageBody() data: { quizId: string },
  ): { event: 'unsubscribed'; type: 'quiz'; quizId: string } {
    const quizId = data?.quizId;
    if (!quizId || typeof quizId !== 'string') {
      return { event: 'unsubscribed', type: 'quiz', quizId: '' };
    }

    void client.leave(`${QUIZ_ROOM_PREFIX}${quizId}`);

    this.logger.debug({
      event: 'comment_gateway_client_unsubscribed_quiz',
      socketId: client.id,
      quizId,
    });

    return { event: 'unsubscribed', type: 'quiz', quizId };
  }

  /**
   * Ping handler — returns connection status for the authenticated user.
   */
  @SubscribeMessage('ping')
  async handlePing(@WsCurrentUser() user: JwtPayload): Promise<{
    ok: boolean;
    connectedCount: number;
    localCount: number;
  }> {
    const localCount = this.userSockets.get(user.sub)?.size ?? 0;
    let connectedCount = localCount;
    try {
      const remoteSockets = (await this.server
        .in(`${USER_ROOM_PREFIX}${user.sub}`)
        .fetchSockets()) as RemoteSocket<Record<string, never>, unknown>[];
      connectedCount = remoteSockets.length;
    } catch (error) {
      this.logger.warn({
        event: 'comment_ping_fetch_sockets_failed',
        userId: user.sub,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    return { ok: true, connectedCount, localCount };
  }

  /**
   * Broadcast a comment event to all clients subscribed to the quiz room.
   * Called by CommentWebSocketListener after subscribing to CommentDomainEventBus.
   * Only events with a quizId are broadcast to quiz rooms.
   */
  pushToQuiz(event: CommentDomainEvent): void {
    // Only events with quizId can be broadcast to quiz rooms
    if (!('quizId' in event) || !event.quizId) {
      return;
    }

    const quizRoom = `${QUIZ_ROOM_PREFIX}${event.quizId}`;
    const payload = this.serializeEvent(event);

    this.server.to(quizRoom).emit('comment', payload);

    this.logger.debug({
      event: 'comment_pushed_to_quiz',
      eventType: event.eventType,
      quizId: event.quizId,
      room: quizRoom,
    });
  }

  /**
   * Push a personal notification to a specific user (e.g., when they are
   * mentioned in a comment or when someone replies to their comment).
   */
  pushToUser(userId: string, event: CommentDomainEvent): void {
    const userRoom = `${USER_ROOM_PREFIX}${userId}`;
    const payload = this.serializeEvent(event);

    this.server.to(userRoom).emit('comment', payload);

    this.logger.debug({
      event: 'comment_pushed_to_user',
      eventType: event.eventType,
      userId,
      room: userRoom,
    });
  }

  private serializeEvent(event: CommentDomainEvent): Record<string, unknown> {
    const base = {
      eventType: event.eventType,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    };

    switch (event.eventType) {
      case 'comment_created':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          parentCommentId: event.parentCommentId,
          authorId: event.authorId,
          authorUsername: event.authorUsername,
          isReply: event.isReply,
          // Include full snapshot for direct state application
          snapshot: event.snapshot,
        };

      case 'comment_edited':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          authorId: event.authorId,
          // Include full snapshot for direct state application
          snapshot: event.snapshot,
        };

      case 'comment_deleted':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          authorId: event.authorId,
          parentCommentId: event.parentCommentId,
        };

      case 'comment_hidden':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          moderatorId: event.moderatorId,
          // Include full snapshot for direct state application
          snapshot: event.snapshot,
        };

      case 'comment_restored':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          moderatorId: event.moderatorId,
          // Include full snapshot for direct state application
          snapshot: event.snapshot,
        };

      case 'vote_cast':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          voterId: event.voterId,
          value: event.value,
          // Include updated vote counts for direct state application
          votesCount: event.votesCount,
          upvotesCount: event.upvotesCount,
          downvotesCount: event.downvotesCount,
        };

      case 'vote_removed':
        return {
          ...base,
          commentId: event.commentId,
          quizId: event.quizId,
          voterId: event.voterId,
          // Include updated vote counts for direct state application
          votesCount: event.votesCount,
          upvotesCount: event.upvotesCount,
          downvotesCount: event.downvotesCount,
        };

      default:
        return base;
    }
  }
}
