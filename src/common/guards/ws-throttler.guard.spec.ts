import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { PinoLogger } from 'nestjs-pino';
import { WsThrottlerGuard } from './ws-throttler.guard';
import {
  WS_THROTTLE_METADATA_KEY,
  WS_THROTTLE_PUBLIC_METADATA_KEY,
} from '@/common/decorators/ws-throttle.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import type { ThrottlerCachePort } from '@/common/ports/throttler-cache.port';
import type { RedisCircuitPort, RedisCircuitState } from '@/common/ports/redis-circuit.port';
import type { MetricsRegistry } from '@/core/observability/metrics.registry';

interface FakeSocket {
  id: string;
  nsp: { name: string };
  handshake: { auth?: Record<string, unknown> };
  user?: { sub: string };
}

const buildContext = (overrides: {
  handlerOptions?: { default: { limit: number; ttl: number } } | undefined;
  handlerIsPublic?: boolean;
  classIsPublic?: boolean;
  socketUserSub?: string;
  socketNsp?: string;
  handlerName?: string;
  reflector?: Reflector;
}): {
  context: ExecutionContext;
  socket: FakeSocket;
  handler: () => void;
  reflector: Reflector;
} => {
  const socket: FakeSocket = {
    id: 'sock-1',
    nsp: { name: overrides.socketNsp ?? '/instances' },
    handshake: {},
    user: overrides.socketUserSub !== undefined ? { sub: overrides.socketUserSub } : undefined,
  };

  const handler = function handlerNameFn(): void {
    return;
  };
  Object.defineProperty(handler, 'name', { value: overrides.handlerName ?? 'handlerNameFn' });

  const classTarget = class Host {};

  const reflector: Reflector =
    overrides.reflector ??
    ({
      get: (key: string, target: object) => {
        if (key === WS_THROTTLE_PUBLIC_METADATA_KEY && target === handler) {
          return overrides.handlerIsPublic ?? false;
        }
        if (key === WS_THROTTLE_PUBLIC_METADATA_KEY && target === classTarget) {
          return overrides.classIsPublic ?? false;
        }
        if (key === IS_PUBLIC_KEY && target === handler) {
          return overrides.handlerIsPublic ?? false;
        }
        if (key === IS_PUBLIC_KEY && target === classTarget) {
          return overrides.classIsPublic ?? false;
        }
        return undefined;
      },
      getAllAndOverride: (key: string) => {
        if (key === WS_THROTTLE_METADATA_KEY) {
          return overrides.handlerOptions ?? undefined;
        }
        return undefined;
      },
    } as unknown as Reflector);

  const context: ExecutionContext = {
    getHandler: () => handler,
    getClass: () => classTarget,
    switchToWs: () => ({
      getClient: () => socket,
      getData: () => undefined,
      getArgs: () => [socket],
      getAck: () => undefined,
      getPattern: () => 'message',
    }),
  } as unknown as ExecutionContext;

  return { context, socket, handler, reflector };
};

describe('WsThrottlerGuard', () => {
  function makeLogger(): PinoLogger {
    return {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    } as unknown as PinoLogger;
  }

  function buildCache(impl: ThrottlerCachePort['incrementWindowCounterWithPttl']): {
    cache: ThrottlerCachePort;
    calls: Array<{ key: string; windowMs: number }>;
  } {
    const calls: Array<{ key: string; windowMs: number }> = [];
    const cache: ThrottlerCachePort = {
      incrementWindowCounterWithPttl: async (key, windowMs) => {
        calls.push({ key, windowMs });
        return impl(key, windowMs);
      },
    };
    return { cache, calls };
  }

  function buildCircuit(state: RedisCircuitState): RedisCircuitPort {
    return { getCircuitState: () => state };
  }

  function buildMetrics(): MetricsRegistry {
    return { incWsThrottlerRejected: jest.fn() } as unknown as MetricsRegistry;
  }

  it('rejects with WsException when the per-user counter exceeds the configured limit', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 31, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(WsException);
    expect(calls).toHaveLength(1);
    expect(metrics.incWsThrottlerRejected).toHaveBeenCalledTimes(1);
  });

  it('allows the request when the counter is at or below the limit', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 10, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(metrics.incWsThrottlerRejected).not.toHaveBeenCalled();
  });

  it('keys the counter on namespace + handler + user sub', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 1, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
      socketNsp: '/notifications',
      socketUserSub: 'user-42',
      handlerName: 'handlePing',
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await guard.canActivate(context);

    expect(calls).toEqual([{ key: 'ws:/notifications:handlePing:user-42', windowMs: 60_000 }]);
  });

  it('fails open when the Redis circuit is open', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 999, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('open'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('fails open when the cache throws', async () => {
    const cache: ThrottlerCachePort = {
      incrementWindowCounterWithPttl: jest.fn(async () => {
        throw new Error('redis-down');
      }),
    };
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(metrics.incWsThrottlerRejected).not.toHaveBeenCalled();
  });

  it('skips throttling when @WsThrottlePublic is set on the handler', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 999, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: undefined,
      handlerIsPublic: true,
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('skips throttling when @WsThrottlePublic is set on the class', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 999, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: undefined,
      classIsPublic: true,
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('skips throttling when no options are configured', async () => {
    const { cache, calls } = buildCache(async () => ({ count: 999, pttlMs: 60_000 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: undefined,
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('attaches retryAfterMs to the WsException on rejection', async () => {
    const { cache } = buildCache(async () => ({ count: 31, pttlMs: 12_345 }));
    const metrics = buildMetrics();
    const { context, reflector } = buildContext({
      handlerOptions: { default: { limit: 30, ttl: 60_000 } },
    });

    const guard = WsThrottlerGuard.create({
      reflector,
      cache,
      circuit: buildCircuit('closed'),
      metrics,
      logger: makeLogger(),
    });

    try {
      await guard.canActivate(context);
      throw new Error('expected guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const inner = (error as WsException).getError() as {
        code: string;
        message: string;
        retryAfterMs: number;
      };
      expect(inner).toMatchObject({
        code: 'RATE_LIMITED',
        message: 'Too many messages — slow down',
        retryAfterMs: 12_345,
      });
    }
  });
});
