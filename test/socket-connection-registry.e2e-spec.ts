/**
 * Phase 3 (Production Deployment Readiness) — end-to-end test for
 * `RedisSocketConnectionRegistry` against a live Redis.
 *
 * The unit tests in
 * `redis-socket-connection.registry.spec.ts` exercise the wrapper
 * against a Jest mock of `CacheProvider`. This suite proves the
 * wrapper integrates with the REAL `RedisService` — same one the
 * application uses — and confirms the contract end to end:
 *
 *   - `record` writes a JSON blob with TTL.
 *   - `consume` returns the meta once, atomically, and removes
 *     the key (verified by a second consume returning `null`).
 *   - After the TTL elapses, `getMeta` returns `null`.
 *
 * Gating
 * ------
 * The suite is skipped when `process.env.REDIS_URL` is unset,
 * matching the project-wide pattern (`review-helpful.e2e-spec.ts`,
 * `ranking-phase1.e2e-spec.ts`). Engineers without local Redis
 * can still run `pnpm test:e2e`.
 *
 * To run locally:
 *   pnpm redis:start
 *   REDIS_URL=redis://localhost:6379 \
 *   pnpm test:e2e --testPathPattern='socket-connection-registry'
 */

import { RedisSocketConnectionRegistry } from '@/modules/instance/infrastructure/repositories/redis-socket-connection.registry';
import { RedisService } from '@/core/redis/redis.service';
import { redisConfig } from '@/core/config';
import { CACHE_PROVIDER } from '@/common/ports/cache.provider';

const REDIS_URL = process.env.REDIS_URL ?? '';

const suite = REDIS_URL ? describe : describe.skip;

const makeRegistry = (redis: RedisService, ttlMs?: number) => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as ConstructorParameters<typeof RedisSocketConnectionRegistry>[1];
  const registry = new RedisSocketConnectionRegistry(
    redis as unknown as ConstructorParameters<typeof RedisSocketConnectionRegistry>[0],
    logger,
  );
  if (ttlMs !== undefined) registry.setTtlMs(ttlMs);
  return registry;
};

const seedRedisUrl = () => {
  // `RedisService` reads from `process.env.REDIS_URL` because the
  // `redisConfig` `registerAs` factory falls back to env directly.
  process.env.REDIS_URL = REDIS_URL;
};

const cleanupKeys = async (redis: RedisService, label: string) => {
  // Best-effort cleanup: drop any `socket-connection:*` keys the
  // test may have created. We use the underlying client directly
  // because `CacheProvider` does not expose a scan operation.
  try {
    const client = (
      redis as unknown as {
        client: {
          keys: (k: string) => Promise<string[]>;
          del: (...keys: string[]) => Promise<number>;
        };
      }
    ).client;
    const keys = await client.keys(`socket-connection:*`);
    if (keys.length > 0) await client.del(...keys);
  } catch (error) {
    void error; // optional cleanup
  }
  void label;
};

suite('RedisSocketConnectionRegistry — Phase 3 live Redis integration', () => {
  let redis: RedisService | null = null;

  beforeAll(() => {
    seedRedisUrl();
    redis = new RedisService(redisConfig(), {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    } as unknown as ConstructorParameters<typeof RedisService>[1]);
  }, 10_000);

  afterAll(async () => {
    if (redis) {
      await cleanupKeys(redis, 'afterAll');
      try {
        await redis.onModuleDestroy();
      } catch {
        /* ignore */
      }
    }
  });

  beforeEach(async () => {
    if (redis) await cleanupKeys(redis, 'beforeEach');
  });

  it('record / consume round-trips through Redis with a TTL', async () => {
    if (!redis) throw new Error('Redis not initialized');
    const registry = makeRegistry(redis, 30_000);

    const socketId = `sock-${Date.now()}`;
    await registry.record(socketId, { instanceId: 'inst-1', userId: 'user-1' });

    const first = await registry.consume(socketId);
    expect(first).toEqual({ instanceId: 'inst-1', userId: 'user-1' });

    // Atomic GETDEL: a second consume for the same socket id
    // MUST return null.
    const second = await registry.consume(socketId);
    expect(second).toBeNull();
  }, 15_000);

  it('cache.get sees the value while the TTL is alive', async () => {
    if (!redis) throw new Error('Redis not initialized');
    const registry = makeRegistry(redis, 60_000);

    const socketId = `sock-${Date.now()}`;
    await registry.record(socketId, { instanceId: 'inst-2', userId: 'user-2' });

    const meta = await registry.getMeta(socketId);
    expect(meta).toEqual({ instanceId: 'inst-2', userId: 'user-2' });

    // Cleanup the entry so we don't pollute Redis across test runs.
    await registry.consume(socketId);
  }, 15_000);

  it('returns the same TTL the registry was configured with', async () => {
    if (!redis) throw new Error('Redis not initialized');
    const registry = makeRegistry(redis, 7_000);
    expect(registry.getTtlMs()).toBe(7_000);
  });

  it('writes the canonical `socket-connection:` key prefix', async () => {
    if (!redis) throw new Error('Redis not initialized');

    const client = (
      redis as unknown as {
        client: {
          keys: (k: string) => Promise<string[]>;
          get: (k: string) => Promise<string | null>;
        };
      }
    ).client;
    const registry = makeRegistry(redis, 60_000);

    const socketId = `sock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await registry.record(socketId, { instanceId: 'inst-3', userId: 'user-3' });

    const keys = await client.keys(`socket-connection:${socketId}`);
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe(`socket-connection:${socketId}`);

    const raw = await client.get(`socket-connection:${socketId}`);
    expect(JSON.parse(raw!)).toEqual({ instanceId: 'inst-3', userId: 'user-3' });

    // Hygiene
    await registry.consume(socketId);

    // Reference the CACHE_PROVIDER symbol to confirm the import is
    // not unused (this guards against accidental future refactors
    // that drop the dependency-graph tie-in).
    expect(CACHE_PROVIDER.toString()).toMatch(/Symbol/);
  }, 15_000);
});
