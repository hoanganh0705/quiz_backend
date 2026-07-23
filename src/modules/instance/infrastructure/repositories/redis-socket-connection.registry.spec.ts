/**
 * Phase 3 (Production Deployment Readiness) — unit tests for the
 * cross-instance socket connection registry.
 *
 * The registry is a thin wrapper around `CacheProvider.get/set/del/getDel`
 * that adds the cross-cutting concerns of TTL, key prefixing, and
 * JSON-encoded `{instanceId, userId}` blobs. These tests exercise the
 * wrapper in isolation against a Jest mock of the port, so no real
 * Redis is required and the suite runs as part of `pnpm test` even
 * when `REDIS_URL` is unset.
 *
 * What we verify
 * --------------
 *  - `record(...)` writes the JSON blob with the configured TTL.
 *  - `record(...)` is a no-op when the inputs are invalid (empty
 *    socket id, missing userId) and reports `false`.
 *  - `getMeta(...)` returns the parsed meta on a fresh key, `null`
 *    after a missing-key read, and `null` when the stored payload is
 *    malformed (stale or future-schema JSON).
 *  - `consume(...)` returns the meta once and removes the key, so a
 *    second `consume(...)` for the same socket id returns `null` —
 *    this is what makes the disconnect hot path double-emit-safe.
 *  - TTL config is exposed, mutable, and rejects invalid values.
 */
import { RedisSocketConnectionRegistry } from './redis-socket-connection.registry';
import type { CacheProvider } from '@/common/ports/cache.provider';

interface FakeCache {
  get: jest.Mock<Promise<string | null>, [string]>;
  set: jest.Mock<Promise<void>, [string, string, number]>;
  getDel: jest.Mock<Promise<string | null>, [string]>;
}

const buildCache = (): FakeCache => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  getDel: jest.fn(),
});

const buildLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as ConstructorParameters<typeof RedisSocketConnectionRegistry>[1];

const newRegistry = (cache: CacheProvider, ttlMs = 60_000) =>
  new RedisSocketConnectionRegistry(
    cache as unknown as ConstructorParameters<typeof RedisSocketConnectionRegistry>[0],
    buildLogger(),
  );
void newRegistry; // silence unused-export lint when no callers exist below

describe('RedisSocketConnectionRegistry — Phase 3 cross-instance socket meta', () => {
  describe('record', () => {
    it('writes a JSON-encoded {instanceId,userId} blob with the configured TTL', async () => {
      const cache = buildCache();
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      await registry.record('sock-1', { instanceId: 'inst-1', userId: 'user-1' });

      expect(cache.set).toHaveBeenCalledTimes(1);
      const [key, value, ttlMs] = cache.set.mock.calls[0];
      expect(key).toBe('socket-connection:sock-1');
      expect(ttlMs).toBe(60_000);
      expect(JSON.parse(value)).toEqual({ instanceId: 'inst-1', userId: 'user-1' });
    });

    it('returns false and does not call the cache when socketId is empty', async () => {
      const cache = buildCache();
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const ok = await registry.record('', { instanceId: 'inst-1', userId: 'user-1' });

      expect(ok).toBe(false);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('returns false and does not call the cache when userId is missing', async () => {
      const cache = buildCache();
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const ok = await registry.record('sock-1', {
        instanceId: 'inst-1',
        userId: '',
      });

      expect(ok).toBe(false);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('returns false and logs a warning when the cache throws on write', async () => {
      const cache = buildCache();
      cache.set.mockRejectedValueOnce(new Error('redis down'));
      const logger = buildLogger();
      const registry = new RedisSocketConnectionRegistry(cache as unknown as CacheProvider, logger);

      const ok = await registry.record('sock-1', { instanceId: 'inst-1', userId: 'user-1' });

      expect(ok).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'socket_connection_registry_record_failed',
          socketId: 'sock-1',
        }),
      );
    });
  });

  describe('getMeta', () => {
    it('returns the parsed meta when the key exists', async () => {
      const cache = buildCache();
      cache.get.mockResolvedValueOnce(JSON.stringify({ instanceId: 'inst-1', userId: 'user-1' }));
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.getMeta('sock-1');

      expect(meta).toEqual({ instanceId: 'inst-1', userId: 'user-1' });
      expect(cache.get).toHaveBeenCalledWith('socket-connection:sock-1');
    });

    it('returns null on a cache miss', async () => {
      const cache = buildCache();
      cache.get.mockResolvedValueOnce(null);
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.getMeta('sock-1');

      expect(meta).toBeNull();
    });

    it('returns null and swallows malformed JSON', async () => {
      const cache = buildCache();
      cache.get.mockResolvedValueOnce('not-json');
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.getMeta('sock-1');

      expect(meta).toBeNull();
    });

    it('returns null when the JSON lacks the required fields (schema drift)', async () => {
      const cache = buildCache();
      cache.get.mockResolvedValueOnce(JSON.stringify({ instanceId: 'inst-1' }));
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.getMeta('sock-1');

      expect(meta).toBeNull();
    });

    it('returns null and logs a warning when the cache throws on read', async () => {
      const cache = buildCache();
      cache.get.mockRejectedValueOnce(new Error('redis down'));
      const logger = buildLogger();
      const registry = new RedisSocketConnectionRegistry(cache as unknown as CacheProvider, logger);

      const meta = await registry.getMeta('sock-1');

      expect(meta).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'socket_connection_registry_get_failed' }),
      );
    });
  });

  describe('consume', () => {
    it('returns the parsed meta via the atomic GETDEL', async () => {
      const cache = buildCache();
      cache.getDel.mockResolvedValueOnce(
        JSON.stringify({ instanceId: 'inst-1', userId: 'user-1' }),
      );
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.consume('sock-1');

      expect(meta).toEqual({ instanceId: 'inst-1', userId: 'user-1' });
      expect(cache.getDel).toHaveBeenCalledWith('socket-connection:sock-1');
    });

    it('returns null when GETDEL has already drained the key (double-disconnect safe)', async () => {
      // The whole point of the consume-then-GETDEL semantics: a
      // second disconnect for the same socket id (e.g. Socket.IO
      // fires `disconnect` twice for an aborted transport) MUST NOT
      // emit `PlayerDisconnectedEvent` twice.
      const cache = buildCache();
      cache.getDel.mockResolvedValueOnce(null);
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );

      const meta = await registry.consume('sock-1');

      expect(meta).toBeNull();
    });

    it('returns null when GETDEL throws (best-effort)', async () => {
      const cache = buildCache();
      cache.getDel.mockRejectedValueOnce(new Error('redis down'));
      const logger = buildLogger();
      const registry = new RedisSocketConnectionRegistry(cache as unknown as CacheProvider, logger);

      const meta = await registry.consume('sock-1');

      expect(meta).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'socket_connection_registry_consume_failed' }),
      );
    });
  });

  describe('TTL configuration', () => {
    it('uses the default TTL of 60_000 ms unless overridden', async () => {
      const cache = buildCache();
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );
      expect(registry.getTtlMs()).toBe(60_000);
    });

    it('exposes setTtlMs / getTtlMs and rejects invalid values', () => {
      const registry = new RedisSocketConnectionRegistry(
        buildCache() as unknown as CacheProvider,
        buildLogger(),
      );

      registry.setTtlMs(30_000);
      expect(registry.getTtlMs()).toBe(30_000);

      expect(() => registry.setTtlMs(0)).toThrow(/positive/);
      expect(() => registry.setTtlMs(-1)).toThrow(/positive/);
      expect(() => registry.setTtlMs(Number.NaN)).toThrow(/positive/);
      expect(() => registry.setTtlMs(Number.POSITIVE_INFINITY)).toThrow(/positive/);
    });

    it('propagates the configured TTL to the underlying cache on record()', async () => {
      const cache = buildCache();
      const registry = new RedisSocketConnectionRegistry(
        cache as unknown as CacheProvider,
        buildLogger(),
      );
      registry.setTtlMs(5_000);

      await registry.record('sock-1', { instanceId: 'inst-1', userId: 'user-1' });

      const [, , ttlMs] = cache.set.mock.calls[0];
      expect(ttlMs).toBe(5_000);
    });
  });
});
