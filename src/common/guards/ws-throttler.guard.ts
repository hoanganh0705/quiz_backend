import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Socket } from 'socket.io';
import {
  WS_THROTTLE_METADATA_KEY,
  WS_THROTTLE_PUBLIC_METADATA_KEY,
  type WsThrottleOptions,
} from '@/common/decorators/ws-throttle.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import type { AuthenticatedSocket } from '@/common/guards/ws-jwt.guard';
import type { ThrottlerCachePort } from '@/common/ports/throttler-cache.port';
import type { RedisCircuitPort, RedisCircuitState } from '@/common/ports/redis-circuit.port';
import { THROTTLER_CACHE_PORT } from '@/common/ports/throttler-cache.port';
import { REDIS_CIRCUIT_PORT } from '@/common/ports/redis-circuit.port';
import { METRICS_REGISTRY, type MetricsRegistry } from '@/core/observability/metrics.registry';

export interface WsThrottlerGuardDeps {
  reflector: Reflector;
  cache: ThrottlerCachePort;
  circuit: RedisCircuitPort;
  metrics: MetricsRegistry;
  logger: PinoLogger;
}

/**
 * WsThrottlerGuard — per-user message rate limit for `@SubscribeMessage`
 * handlers, backed by {@link ThrottlerCachePort} (same INCR + PEXPIRE Lua
 * the HTTP throttler uses, shared across replicas).
 *
 * Activated only when a handler carries the `@WsThrottle({...})`
 * decorator. Handlers can opt out via `@WsThrottlePublic()`, which mirrors
 * the HTTP `@Public()` semantic for socket-layer handlers.
 *
 * Fail-open: when the Redis circuit is open the guard short-circuits to
 * `true` so a Redis outage does not lock the WS layer out (matches ADR-0029).
 */
@Injectable()
export class WsThrottlerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(THROTTLER_CACHE_PORT) private readonly cache: ThrottlerCachePort,
    @Inject(REDIS_CIRCUIT_PORT) private readonly circuit: RedisCircuitPort,
    @Inject(METRICS_REGISTRY) private readonly metrics: MetricsRegistry,
    @InjectPinoLogger(WsThrottlerGuard.name)
    private readonly logger: PinoLogger,
  ) {}

  static create(deps: WsThrottlerGuardDeps): WsThrottlerGuard {
    const guard = Object.create(WsThrottlerGuard.prototype) as WsThrottlerGuard;
    (guard as unknown as { reflector: Reflector }).reflector = deps.reflector;
    (guard as unknown as { cache: ThrottlerCachePort }).cache = deps.cache;
    (guard as unknown as { circuit: RedisCircuitPort }).circuit = deps.circuit;
    (guard as unknown as { metrics: MetricsRegistry }).metrics = deps.metrics;
    (guard as unknown as { logger: PinoLogger }).logger = deps.logger;
    return guard;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.resolveOptions(context);
    if (!options) return true;

    const state: RedisCircuitState = this.circuit.getCircuitState();
    if (state !== 'closed') {
      this.logger.debug({
        event: 'ws_throttler_skipped_circuit_open',
        msg: 'redis circuit open — failing open',
      });
      return true;
    }

    const handler = context.getHandler();
    const client: Socket = context.switchToWs().getClient();
    const handlerName = handler.name || 'anonymous';
    const userId = (client as AuthenticatedSocket).user?.sub ?? 'anonymous';
    const namespace = client.nsp?.name ?? 'default';

    const key = `ws:${namespace}:${handlerName}:${userId}`;
    const { limit, ttl } = options.default;

    let record: { count: number; pttlMs: number };
    try {
      record = await this.cache.incrementWindowCounterWithPttl(key, ttl);
    } catch (error) {
      this.logger.warn({
        event: 'ws_throttler_fail_open',
        msg: error instanceof Error ? error.message : 'unknown',
      });
      return true;
    }

    const remaining = record.pttlMs > 0 ? record.pttlMs : ttl;

    if (record.count > limit) {
      this.metrics.incWsThrottlerRejected(namespace, handlerName);
      this.logger.warn({
        event: 'ws_throttler_rejected',
        handler: handlerName,
        namespace,
        userId,
        hits: record.count,
        limit,
        ttlMs: remaining,
      });
      throw new WsException({
        code: 'RATE_LIMITED',
        message: 'Too many messages — slow down',
        retryAfterMs: remaining,
      });
    }

    return true;
  }

  private resolveOptions(context: ExecutionContext): WsThrottleOptions | null {
    if (this.reflector.get<boolean>(WS_THROTTLE_PUBLIC_METADATA_KEY, context.getHandler())) {
      return null;
    }
    if (this.reflector.get<boolean>(WS_THROTTLE_PUBLIC_METADATA_KEY, context.getClass())) {
      return null;
    }

    const options = this.reflector.getAllAndOverride<WsThrottleOptions | undefined>(
      WS_THROTTLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (options) return options;

    if (this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler())) {
      return null;
    }
    if (this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getClass())) {
      return null;
    }

    return null;
  }
}
