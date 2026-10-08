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
import { WsThrottlerGuard } from '@/common/guards/ws-throttler.guard';
import { WsThrottlePublic } from '@/common/decorators/ws-throttle.decorator';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '@/modules/instance/transport/filters/ws-exception.filter';
import { resolveWsCorsOrigins } from '@/common/utils/ws-cors.util';
import type { NotificationDomainEvent } from '@/modules/notification/domain/events';

const NAMESPACE = '/notifications';
const USER_ROOM_PREFIX = 'user:';

@WebSocketGateway({
  namespace: NAMESPACE,
  cors: {
    origin: resolveWsCorsOrigins(),
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard, WsThrottlerGuard)
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(NotificationGateway.name)
    private readonly logger: PinoLogger,
  ) {}

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

    const userId = user.sub;
    void client.join(`${USER_ROOM_PREFIX}${userId}`);

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
    void client.leave(`${USER_ROOM_PREFIX}${userId}`);

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

  @WsThrottlePublic()
  @SubscribeMessage('ping')
  handlePing(@WsCurrentUser() user: JwtPayload): Promise<{
    ok: boolean;
    connectedCount: number;
    localCount: number;
  }> {
    const localCount = this.userSockets.get(user.sub)?.size ?? 0;
    return Promise.resolve({ ok: true, connectedCount: localCount, localCount });
  }

  @WsThrottlePublic()
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

  pushToUser(event: NotificationDomainEvent): void {
    const room = `${USER_ROOM_PREFIX}${event.userId}`;
    const payload = this.serializeEvent(event);

    const eventName = this.eventToWireName(event.eventType);
    this.server.to(room).emit(eventName, payload);

    this.logger.debug({
      event: 'notification_pushed_to_user',
      eventType: event.eventType,
      userId: event.userId,
      room,
      wireEventName: eventName,
    });
  }

  private eventToWireName(eventType: NotificationDomainEvent['eventType']): string {
    switch (eventType) {
      case 'notification.sent':
        return 'notification:sent';
      case 'notification.read':
        return 'notification:read';
      case 'notification.unread':
        return 'notification:unread';
      case 'notification.deleted':
        return 'notification:deleted';
    }
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
