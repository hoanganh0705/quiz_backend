import { RedisThrottlerStorage, type IncrementWithPttlResult } from './redis-throttler.storage';
import type { ThrottlerCachePort } from '@/common/ports/throttler-cache.port';

function makePort(impl: (key: string, windowMs: number) => Promise<IncrementWithPttlResult>): {
  port: ThrottlerCachePort;
  calls: Array<{ key: string; windowMs: number }>;
} {
  const calls: Array<{ key: string; windowMs: number }> = [];
  const port: ThrottlerCachePort = {
    incrementWindowCounterWithPttl: async (key, windowMs) => {
      calls.push({ key, windowMs });
      return impl(key, windowMs);
    },
  };
  return { port, calls };
}

describe('RedisThrottlerStorage', () => {
  it('delegates to the cache port with the request key and ttl', async () => {
    const { port, calls } = makePort(async () => ({ count: 1, pttlMs: 60_000 }));
    const storage = new RedisThrottlerStorage(port);

    await storage.increment('throttler:default:user-1', 60_000, 100, 0, 'default');

    expect(calls).toEqual([{ key: 'throttler:default:user-1', windowMs: 60_000 }]);
  });

  it('returns the count and remaining PTTL from the cache port', async () => {
    const { port } = makePort(async () => ({ count: 7, pttlMs: 42_500 }));
    const storage = new RedisThrottlerStorage(port);

    const record = await storage.increment('throttler:default:user-2', 60_000, 100, 0, 'default');

    expect(record.totalHits).toBe(7);
    expect(record.timeToExpire).toBe(42_500);
    expect(record.isBlocked).toBe(false);
    expect(record.timeToBlockExpire).toBe(0);
  });

  it('falls back to the full TTL when the cache returns -1 or -2 PTTL', async () => {
    const cases: Array<{ pttlMs: number }> = [{ pttlMs: -1 }, { pttlMs: -2 }];
    for (const c of cases) {
      const { port } = makePort(async () => ({ count: 5, pttlMs: c.pttlMs }));
      const storage = new RedisThrottlerStorage(port);

      const record = await storage.increment('throttler:default:user-x', 60_000, 100, 0, 'default');

      expect(record.totalHits).toBe(5);
      expect(record.timeToExpire).toBe(60_000);
    }
  });

  it('returns a fail-open record when the cache throws (circuit open)', async () => {
    const { port } = makePort(async () => {
      throw new Error('circuit open');
    });
    const storage = new RedisThrottlerStorage(port);

    const record = await storage.increment('throttler:default:user-3', 60_000, 100, 0, 'default');

    expect(record.totalHits).toBe(0);
    expect(record.timeToExpire).toBe(60_000);
    expect(record.isBlocked).toBe(false);
  });

  it('enforces the limit across two simulated instances sharing the same Redis', async () => {
    const counter = new Map<string, { count: number; pttlMs: number }>();
    const sharedState: ThrottlerCachePort = {
      incrementWindowCounterWithPttl: async (key, windowMs) => {
        const existing = counter.get(key);
        if (existing && existing.pttlMs > 0) {
          const next = existing.count + 1;
          counter.set(key, { count: next, pttlMs: existing.pttlMs - 1 });
          return { count: next, pttlMs: existing.pttlMs - 1 };
        }
        counter.set(key, { count: 1, pttlMs: windowMs - 1 });
        return { count: 1, pttlMs: windowMs - 1 };
      },
    };
    const instanceA = new RedisThrottlerStorage(sharedState);
    const instanceB = new RedisThrottlerStorage(sharedState);

    const records: Array<{ hits: number; expired: number }> = [];
    for (let i = 0; i < 5; i++) {
      const r = await instanceA.increment('throttler:default:shared-user', 60_000, 5, 0, 'default');
      records.push({ hits: r.totalHits, expired: r.timeToExpire });
    }
    for (let i = 0; i < 3; i++) {
      const r = await instanceB.increment('throttler:default:shared-user', 60_000, 5, 0, 'default');
      records.push({ hits: r.totalHits, expired: r.timeToExpire });
    }

    expect(records.map((r) => r.hits)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(records[7]?.hits).toBeGreaterThan(5);
  });

  it('rejects a non-positive ttl up front', async () => {
    const { port } = makePort(async () => ({ count: 1, pttlMs: 60_000 }));
    const storage = new RedisThrottlerStorage(port);

    await expect(storage.increment('k', 0, 100, 0, 'default')).rejects.toThrow(/ttl/i);
    await expect(storage.increment('k', -1, 100, 0, 'default')).rejects.toThrow(/ttl/i);
    await expect(storage.increment('k', 1.5, 100, 0, 'default')).rejects.toThrow(/ttl/i);
  });
});
