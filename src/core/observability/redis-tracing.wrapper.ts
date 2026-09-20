import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { TRACING_PROVIDER, type TracingProvider } from '@/core/observability/tracing.provider';

@Injectable()
export class RedisTracingWrapper {
  constructor(
    @Inject(TRACING_PROVIDER)
    private readonly tracing: TracingProvider,
  ) {}

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
                'redis.key_count':
                  typeof args[0] === 'string' ? 1 : Array.isArray(args[0]) ? args[0].length : 0,
              },
            },
            async () => Promise.resolve(original.apply(target, args) as Awaited<unknown>),
          );
        };
      },
    });
  }
}

const TRACED_COMMANDS = new Set<string>([
  'get',
  'set',
  'del',
  'eval',
  'incr',
  'incrby',
  'decr',
  'decrby',
  'expire',
  'ttl',
  'lpush',
  'rpush',
  'lpop',
  'rpop',
  'hset',
  'hget',
  'hgetall',
  'hdel',
  'sadd',
  'srem',
  'smembers',
  'zadd',
  'zrange',
  'zrangeByScore',
  'publish',
  'subscribe',
]);

const isTracedRedisCommand = (prop: string | symbol): boolean => {
  return typeof prop === 'string' && TRACED_COMMANDS.has(prop.toLowerCase());
};
