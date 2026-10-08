/**
 * Port exposing the atomic INCR + PEXPIRE + PTTL Lua operation that
 * the Redis-backed throttler storage needs on top of the shared
 * Redis client.
 *
 * The throttler storage is the only caller that needs the
 * post-increment PTTL — every other consumer of `CacheProvider`
 * either knows the TTL up front (stampede-protected cache writes)
 * or never cares about expiry (advisory lock release, list ops).
 * Adding `pttl` to `CacheProvider` would pollute the surface for
 * no benefit.
 */
export interface ThrottlerCachePort {
  /**
   * Atomic INCR (creates the key on first hit), conditional
   * PEXPIRE on the first hit, and a post-increment PTTL read —
   * all in a single Lua script round-trip.
   *
   * Returns the post-increment counter value alongside the
   * remaining PTTL. Implementations MUST throw when Redis is
   * unavailable or the circuit is open so the caller can fall
   * back to a fail-open record.
   */
  incrementWindowCounterWithPttl(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; pttlMs: number }>;
}

export const THROTTLER_CACHE_PORT = Symbol('THROTTLER_CACHE_PORT');
