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
 *
 * Phase 3 (Production Deployment Readiness) — emit path updated to
 * `server.to(userRoom).emit(...)` so the Redis-backed Socket.IO
 * adapter (configured in `main.ts`) actually fans the event out to
 * every replica the user is connected to. Pre-Phase-3 the gateway
 * iterated a process-local `userSockets` Map and emitted to each
 * socket directly; that pattern silently dropped notifications
 * delivered to any replica other than the originator.
 *
 * The local `userSockets` Map is retained to back the `ping`
 * handler's reply on the local replica (a "yes, I'm connected to
 * *this* instance" check). Cross-instance counts are answered via
 * the Socket.IO adapter's `fetchSockets` so a client that has a
 * socket on instance B gets a positive answer from instance A.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket, RemoteSocket } from 'socket.io';
import { UseFilters, UseGuards } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { WsJwtGuard, type AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import { WsCurrentUser } from '@/common/decorators/ws-current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { WsExceptionFilter } from '@/modules/instance/transport/filters/ws-exception.filter';
import type { NotificationDomainEvent } from '@/modules/notification/domain/events';

/**
 * CORS origins for the WebSocket gateway, sourced from the same CORS_ORIGINS
 * environment variable used by the HTTP layer (server.config.ts).
 *
 * Phase 6 (rev6.1): changed from `origin: '*'` to explicit origins for
 * improved security posture. The previous wildcard configuration was
 * technically rejected by browsers when `credentials: true` is set (browsers
 * don't allow `*` with credentials), but the explicit configuration makes
 * the intent clear and aligns with the HTTP layer's CORS policy.
 */
const getCorsOrigins = (): string | string[] => {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : '*';
};

const NAMESPACE = '/notifications';
const USER_ROOM_PREFIX = 'user:';

@WebSocketGateway({
  namespace: NAMESPACE,
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /**
   * Local per-replica mirror of `server.rooms`. Used only for the
   * `ping` handler's local-replica count, NOT for fan-out (which
   * goes through `server.to(room).emit` so the Redis adapter can
   * reach every replica the target user is connected to).
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

  /**
   * Client explicitly requests the count of currently connected sockets for their user.
   *
   * Phase 3 — this now resolves through the Socket.IO adapter so a
   * client connected to instance B that pings instance A still
   * observes the correct cross-instance count. The local Map is
   * kept for observability but is no longer the source of truth.
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
      // `fetchSockets` requires the client to be in the namespace,
      // which it always is here. A failure indicates a configuration
      // problem (e.g. the Redis adapter was disabled mid-flight) —
      // surface it in the logs and return the local count as a
      // conservative fallback rather than throwing.
      this.logger.warn({
        event: 'notification_ping_fetch_sockets_failed',
        userId: user.sub,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    return { ok: true, connectedCount, localCount };
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
   * Push a notification domain event to all connected sockets of
   * the target user. Called by NotificationWebSocketListener after
   * subscribing to NotificationDomainEventBus.
   *
   * Phase 3 — emit is now addressed to the user-scoped room, so
   * the Redis-backed Socket.IO adapter handles cross-instance
   * fan-out. The previous local-Map iteration would silently drop
   * notifications for clients connected to any replica other than
   * the originator; that bug is fixed here.
   */
  pushToUser(event: NotificationDomainEvent): void {
    const room = `${USER_ROOM_PREFIX}${event.userId}`;
    const payload = this.serializeEvent(event);

    this.server.to(room).emit('notification', payload);

    this.logger.debug({
      event: 'notification_pushed_to_user',
      eventType: event.eventType,
      userId: event.userId,
      room,
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
