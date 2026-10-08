/**
 * RedisThrottlerStorage — fleet-wide (per-process-merged) throttler
 * storage backed by the shared Redis cache.
 *
 * Replaces the default NestJS in-memory `ThrottlerStorageService`
 * so the global `ThrottlerGuard` rejects requests based on a single
 * counter shared by every replica. This is required because the
 * MemStorage limit `100` was effectively `100 × N replicas` — any
 * fleet member could ignore the limit by claiming a fresh budget.
 */
export interface ThrottlerStorageRecordShape {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export interface ThrottlerStorageLike {
  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecordShape>;
}

/**
 * Return shape of
 * {@link ThrottlerCachePort.incrementWindowCounterWithPttl}.
 *   - `count`  — the value of the counter after the increment.
 *   - `pttlMs` — the remaining PTTL after the increment. Will be
 *                -1 if Redis cannot determine the TTL and -2 if the
 *                key does not exist. The storage translates both
 *                into "use the full TTL".
 */
export interface IncrementWithPttlResult {
  count: number;
  pttlMs: number;
}

/**
 * Default Redis Lua used by {@link RedisThrottlerStorage}. Runs
 * INCR, conditionally PEXPIREs on the first hit (`current == 1`)
 * and returns both the new counter value and the key's remaining
 * PTTL in a single round trip.
 */
export const THROTTLER_INCREMENT_LUA = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end
  local pttl = redis.call("PTTL", KEYS[1])
  return { current, pttl }
`;

/**
 * Redis-backed implementation of the NestJS `ThrottlerStorage`
 * contract.
 *
 * On the happy path it forwards the increment to the supplied
 * {@link import('@/common/ports/throttler-cache.port').ThrottlerCachePort}
 * (which runs the Lua script under the shared Redis circuit
 * breaker). When the cache throws — typically because the
 * circuit is open — it returns a fail-open record so the API
 * stays available instead of leaking an exception from the
 * storage layer; the upstream `ThrottlerGuard` rejects nothing.
 *
 * The `throttlerName` and `blockDuration` arguments are part of
 * the upstream contract; this implementation does not yet support
 * per-route blocking windows and intentionally ignores them
 * (matches the existing configuration: every throttler uses
 * `0` for `blockDuration`).
 */
export class RedisThrottlerStorage implements ThrottlerStorageLike {
  private readonly cache: import('@/common/ports/throttler-cache.port').ThrottlerCachePort;

  constructor(cache: import('@/common/ports/throttler-cache.port').ThrottlerCachePort) {
    this.cache = cache;
  }

  async increment(
    key: string,
    ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecordShape> {
    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new Error('RedisThrottlerStorage: ttl must be a positive integer');
    }

    let record: IncrementWithPttlResult;
    try {
      record = await this.cache.incrementWindowCounterWithPttl(key, ttl);
    } catch {
      return {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const remaining = record.pttlMs > 0 ? record.pttlMs : ttl;

    return {
      totalHits: record.count,
      timeToExpire: remaining,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
