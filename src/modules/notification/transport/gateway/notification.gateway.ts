/**
 * Notification Gateway
 *
 * Real-time WebSocket gateway for delivering notification lifecycle events
 * (sent, read, unread, deleted) to connected clients.
 *
 * Clients connect with a JWT token via handshake auth or Authorization header.
 * On connect, the client joins a user-scoped room `user:{userId}`.
 * When notification events are published via NotificationDomainEventBus,
 * this gateway broadcasts them to all connected sockets for that user.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseFilters, UseGuards } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsJwtGuard, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '@/modules/instance/transport/filters/ws-exception.filter';
import type { NotificationDomainEvent } from '@/modules/notification/domain/events';

const NAMESPACE = '/notifications';
const USER_ROOM_PREFIX = 'user:';

@WebSocketGateway({
  namespace: NAMESPACE,
  cors: {
    origin: '*',
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /**
   * Maps userId → Set of connected socket IDs.
   * Used to track active connections per user and route events correctly.
   */
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(NotificationGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  handleConnection(client: Socket): void {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.user;
    if (!user?.sub) return;

    const userId = user.sub;
    client.join(`${USER_ROOM_PREFIX}${userId}`);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.info({
      event: 'notification_gateway_client_connected',
      socketId: client.id,
      userId,
    });
  }

  handleDisconnect(client: Socket): void {
    const authClient = client as AuthenticatedSocket;
    const user = authClient.user;
    if (!user?.sub) return;

    const userId = user.sub;
    client.leave(`${USER_ROOM_PREFIX}${userId}`);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.info({
      event: 'notification_gateway_client_disconnected',
      socketId: client.id,
      userId,
    });
  }

  /**
   * Client explicitly requests the count of currently connected sockets for their user.
   */
  @SubscribeMessage('ping')
  handlePing(@WsCurrentUser() user: JwtPayload): { ok: boolean; connectedCount: number } {
    const sockets = this.userSockets.get(user.sub);
    return { ok: true, connectedCount: sockets?.size ?? 0 };
  }

  /**
   * Client confirms subscription — logs the subscription.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @WsCurrentUser() user: JwtPayload,
  ): { event: 'subscribed'; userId: string } {
    this.logger.debug({
      event: 'notification_client_subscribed',
      socketId: client.id,
      userId: user.sub,
    });

    return { event: 'subscribed', userId: user.sub };
  }

  /**
   * Push a notification domain event to all connected sockets of the target user.
   * Called by NotificationWebSocketListener after subscribing to NotificationDomainEventBus.
   */
  pushToUser(event: NotificationDomainEvent): void {
    const socketIds = this.userSockets.get(event.userId);

    if (!socketIds || socketIds.size === 0) {
      this.logger.debug({
        event: 'notification_push_no_active_sockets',
        eventType: event.eventType,
        userId: event.userId,
      });
      return;
    }

    const payload = this.serializeEvent(event);

    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('notification', payload);
      }
    }

    this.logger.debug({
      event: 'notification_pushed_to_user',
      eventType: event.eventType,
      userId: event.userId,
      recipientCount: socketIds.size,
    });
  }

  private serializeEvent(event: NotificationDomainEvent): Record<string, unknown> {
    switch (event.eventType) {
      case 'notification.sent':
        return {
          eventType: event.eventType,
          notificationId: event.notificationId,
          userId: event.userId,
          type: event.type,
          channel: event.channel,
          timestamp: this.toIso(event.timestamp),
        };

      case 'notification.read':
      case 'notification.unread':
      case 'notification.deleted':
        return {
          eventType: event.eventType,
          notificationId: event.notificationId,
          userId: event.userId,
          timestamp: this.toIso(event.timestamp),
        };
    }
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
