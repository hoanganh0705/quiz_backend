/**
 * Coin Gateway
 *
 * Real-time WebSocket gateway that fans out per-user coin events to the
 * matching `user:{userId}` room. Mirrors the
 * `NotificationGateway` / `NotificationWebSocketListener` pattern so
 * reviewers can pattern-match against existing code (design §10.1).
 *
 * ## Wire contract
 *
 *   - Namespace: `/coins` (mirrors `/notifications`)
 *   - On connect the client joins `user:{userId}` after the
 *     `WsJwtGuard` populates `socket.user`.
 *   - Emit names are colon-separated (`coin:balance_changed`,
 *     `coin:transaction_recorded`) so the frontend catalogue in
 *     `quiz_frontend/src/lib/realtime/events.ts` is the single source
 *     of truth for the wire contract.
 *
 * ## Realtime fan-out
 *
 * Emits addressed to a room are handled by the Redis-backed
 * Socket.IO adapter configured in `main.ts`. A user with sockets
 * connected to multiple replicas receives the event on every
 * replica — the local `userSockets` Map is only used for the local
 * `ping` count, exactly the same shape as `NotificationGateway`.
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
import type { CoinDomainEvent } from '../../domain/events/coin-domain.events';

const NAMESPACE = '/coins';
const USER_ROOM_PREFIX = 'user:';

const WIRE_EVENT_BALANCE_CHANGED = 'coin:balance_changed' as const;
const WIRE_EVENT_TRANSACTION_RECORDED = 'coin:transaction_recorded' as const;

/**
 * CORS origins for the WebSocket gateway, sourced from the same `CORS_ORIGINS`
 * environment variable used by the HTTP layer (server.config.ts). Mirrors the
 * `NotificationGateway` configuration.
 */
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
export class CoinGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /**
   * Local per-replica mirror of `server.rooms`. Used only for the
   * `ping` handler's local-replica count. Fan-out goes through
   * `server.to(room).emit(...)` so the Redis-backed Socket.IO
   * adapter reaches every replica the user is connected to. See
   * `NotificationGateway` for the same pattern.
   */
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(CoinGateway.name)
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
      event: 'coin_gateway_client_connected',
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
      event: 'coin_gateway_client_disconnected',
      socketId: client.id,
      userId,
    });
  }

  /**
   * Resolve the local + cross-instance connection count for the
   * caller's user. Mirrors `NotificationGateway.handlePing`.
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
        event: 'coin_ping_fetch_sockets_failed',
        userId: user.sub,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    return { ok: true, connectedCount, localCount };
  }

  /**
   * Confirm the subscription. Returned to the caller as an ack frame.
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @WsCurrentUser() user: JwtPayload,
  ): { event: 'subscribed'; userId: string } {
    this.logger.debug({
      event: 'coin_client_subscribed',
      socketId: client.id,
      userId: user.sub,
    });

    return { event: 'subscribed', userId: user.sub };
  }

  /**
   * Push a coin domain event to the user's connected sockets.
   *
   * Called from `CoinWebSocketListener` after it sees the matching
   * event from `CoinDomainEventBus`. Mirrors the
   * `NotificationGateway.pushToUser(...)` shape.
   *
   * The domain bus carries two event variants today:
   *   - `coin.balance_changed` — slim payload (delta + newBalance)
   *   - `coin.transaction_recorded` — full ledger row for the wallet
   *     history page in case it wants to prepend without re-fetching.
   */
  pushToUser(event: CoinDomainEvent): void {
    const room = `${USER_ROOM_PREFIX}${event.userId}`;
    const payload = this.serializeEvent(event);
    const eventName = this.eventToWireName(event.eventType);

    this.server.to(room).emit(eventName, payload);

    this.logger.debug({
      event: 'coin_pushed_to_user',
      eventType: event.eventType,
      userId: event.userId,
      room,
      wireEventName: eventName,
    });
  }

  private eventToWireName(eventType: CoinDomainEvent['eventType']): string {
    switch (eventType) {
      case 'coin.balance_changed':
        return WIRE_EVENT_BALANCE_CHANGED;
      case 'coin.transaction_recorded':
        return WIRE_EVENT_TRANSACTION_RECORDED;
    }
  }

  private serializeEvent(event: CoinDomainEvent): Record<string, unknown> {
    if (event.eventType === 'coin.balance_changed') {
      const balanceChanged = event;
      return {
        eventType: balanceChanged.eventType,
        userId: balanceChanged.userId,
        delta: balanceChanged.delta,
        newBalance: balanceChanged.newBalance,
        reason: balanceChanged.reason,
        referenceType: balanceChanged.referenceType,
        referenceId: balanceChanged.referenceId,
        timestamp: this.toIso(balanceChanged.timestamp),
      };
    }

    const transactionRecorded = event;
    return {
      eventType: transactionRecorded.eventType,
      transactionId: transactionRecorded.transactionId,
      userId: transactionRecorded.userId,
      reason: transactionRecorded.reason,
      amount: transactionRecorded.amount,
      balanceAfter: transactionRecorded.balanceAfter,
      referenceType: transactionRecorded.referenceType,
      referenceId: transactionRecorded.referenceId,
      timestamp: this.toIso(transactionRecorded.timestamp),
    };
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
