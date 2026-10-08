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
import type { CoinDomainEvent } from '../../domain/events/coin-domain.events';

const NAMESPACE = '/coins';
const USER_ROOM_PREFIX = 'user:';

const WIRE_EVENT_BALANCE_CHANGED = 'coin:balance_changed' as const;
const WIRE_EVENT_TRANSACTION_RECORDED = 'coin:transaction_recorded' as const;

@WebSocketGateway({
  namespace: NAMESPACE,
  cors: {
    origin: resolveWsCorsOrigins(),
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard, WsThrottlerGuard)
export class CoinGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(CoinGateway.name)
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
      event: 'coin_client_subscribed',
      socketId: client.id,
      userId: user.sub,
    });

    return { event: 'subscribed', userId: user.sub };
  }

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
      case 'coin.refunded':
        return 'coin:refunded';
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

    if (event.eventType === 'coin.refunded') {
      const refunded = event;
      return {
        eventType: refunded.eventType,
        refundId: refunded.refundId,
        userId: refunded.userId,
        originalTransactionId: refunded.originalTransactionId,
        originalReason: refunded.originalReason,
        refundAmount: refunded.refundAmount,
        balanceAfter: refunded.balanceAfter,
        refundReason: refunded.refundReason,
        referenceType: refunded.referenceType,
        referenceId: refunded.referenceId,
        timestamp: this.toIso(refunded.timestamp),
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
