/**
 * Phase 5 #1 — Redis client tracing wrapper.
 *
 * Wraps every ioredis call in a `client` span so the trace tree
 * shows `HTTP request → Redis call` with the matched attribute
 * set. Span names follow the pattern `redis.<COMMAND>` (e.g.
 * `redis.GET`, `redis.SET`, `redis.DEL`); the trace gets one
 * span per command call, which the operator can grep for in
 * the trace logs.
 *
 * Why a wrapper and not the ioredis `monitor` event?
 * --------------------------------------------------
 * The `monitor` event fires *after* the command has been sent
 * and the response received. By that point the span cannot
 * capture duration. The wrapper attaches a span before the
 * command runs and ends it on resolve/reject — yielding a true
 * `start → end` measurement.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  TRACING_PROVIDER,
  type TracingProvider,
} from '@/core/observability/tracing.provider';

@Injectable()
export class RedisTracingWrapper {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

  /**
   * Wrap an ioredis client. Every command method (`get`, `set`,
   * `del`, `eval`, ...) is forwarded through `withSpan`. The
   * returned client is a *Proxy* — original methods are still
   * callable, only `then`-able commands (`get`, `set`, ...) are
   * traced.
   */
  wrap(client: Redis): Redis {
    return new Proxy(client, {
      get: (target, prop, receiver) => {
        const original = Reflect.get(target, prop, receiver) as unknown;
        if (typeof original !== 'function') return original;
        if (!isTracedRedisCommand(prop)) return original.bind(target);

        return async (...args: unknown[]) => {
          return this.tracing.withSpan(
            `redis.${String(prop).toUpperCase()}`,
            {
              kind: 'client',
              attributes: {
                'db.system': 'redis',
                'redis.command': String(prop),
                'redis.key_count': typeof args[0] === 'string' ? 1 : Array.isArray(args[0]) ? args[0].length : 0,
              },
            },
            async () => original.apply(target, args),
          );
        };
      },
    });
  }
}

/**
 * Only `then`-able commands emit spans; helper methods like
 * `duplicate()` or `defineCommand()` should not be wrapped.
 * The ioredis API exposes `then`-able methods directly on the
 * client prototype (e.g. `client.get`, `client.set`); the
 * rest of the API surface (`status`, `options`, etc.) returns
 * non-functions or `Promise<void>`-shaped helpers that don't
 * represent a single Redis call.
 */
const TRACED_COMMANDS = new Set<string>([
  'get', 'set', 'del', 'eval', 'incr', 'incrby', 'decr', 'decrby',
  'expire', 'ttl', 'lpush', 'rpush', 'lpop', 'rpop', 'hset', 'hget',
  'hgetall', 'hdel', 'sadd', 'srem', 'smembers', 'zadd', 'zrange',
  'zrangeByScore', 'publish', 'subscribe',
]);

const isTracedRedisCommand = (prop: string | symbol): boolean => {
  return typeof prop === 'string' && TRACED_COMMANDS.has(prop.toLowerCase());
};