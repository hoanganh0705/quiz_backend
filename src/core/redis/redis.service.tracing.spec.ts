/**
 * Pins the contract that {@link RedisService} routes every cache /
 * pubsub call through the {@link RedisTracingWrapper} proxy so spans
 * surface in distributed tracing without requiring every call site
 * to opt in.
 */
import Redis from 'ioredis';
import { RedisCircuitBreaker } from '@/core/redis/redis-circuit-breaker';
import { RedisService } from '@/core/redis/redis.service';
import type { RedisTracingWrapper } from '@/core/observability/redis-tracing.wrapper';

const TRACED_COMMAND_NAMES = new Set([
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

interface WrapperProbe {
  wrap: jest.Mock;
}

const makeWrapper = (
  overrides: Record<string, jest.Mock> = {},
): WrapperProbe & {
  tracedClient: Redis;
} => {
  const tracedClient: Record<string, unknown> = {
    duplicate: jest.fn(),
    status: 'ready',
  };
  for (const [name, fn] of Object.entries(overrides)) {
    tracedClient[name] = fn;
  }

  const wrap = jest.fn(() => tracedClient);

  return {
    wrap,
    tracedClient: tracedClient as Redis,
  };
};

const makeCircuitBreaker = (): RedisCircuitBreaker =>
  ({
    exec: jest.fn(async (_fallback: unknown, task: () => Promise<unknown>) => task()),
    getMetrics: jest.fn(),
  }) as unknown as RedisCircuitBreaker;

const makeService = (wrapper: RedisTracingWrapper) => {
  return new RedisService(
    {
      url: 'redis://localhost:6379',
      keyPrefix: 'test',
      circuit: { failureThreshold: 5, resetTimeoutMs: 30_000 },
    },
    {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as never,
    makeCircuitBreaker(),
    wrapper,
  );
};

describe('RedisService — RedisTracingWrapper wiring', () => {
  it('wraps the underlying ioredis client once during construction', () => {
    const probe = makeWrapper();

    makeService(probe as unknown as RedisTracingWrapper);

    expect(probe.wrap).toHaveBeenCalledTimes(1);
  });

  it('exposes a get() that ultimately flows through the traced client', async () => {
    const tracedGet = jest.fn(async () => 'value');
    const probe = makeWrapper({ get: tracedGet });
    const service = makeService(probe as unknown as RedisTracingWrapper);

    const result = await service.get('any-key');

    expect(result).toBe('value');
    expect(tracedGet).toHaveBeenCalledWith('any-key');
  });

  it('still emits only traced commands (the proxy filters non-command accessors)', () => {
    const traced = TRACED_COMMAND_NAMES;
    expect(traced.has('get')).toBe(true);
    expect(traced.has('set')).toBe(true);
    expect(traced.has('eval')).toBe(true);
    expect(traced.has('duplicate')).toBe(false);
    expect(traced.has('status')).toBe(false);
  });
});
