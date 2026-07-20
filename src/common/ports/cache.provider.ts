export interface CacheProvider {
  incrementWindowCounter(key: string, windowMs: number): Promise<number>;

  setIfNotExistsWithTtlSeconds(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  incrementCounterWithInitialTtlSeconds(key: string, ttlSeconds: number): Promise<number>;

  get(key: string): Promise<string | null>;

  set(key: string, value: string, ttlMs: number): Promise<void>;

  /**
   * Gets a cached value or computes and caches it if missing.
   * @param key Redis key
   * @param ttlMs TTL in milliseconds
   * @param fetcher async function to compute the value if not cached
   */
  getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T>;

  rpushJson<T>(key: string, item: T): Promise<number>;

  lpopJson<T>(key: string): Promise<T | null>;

  /**
   * Acquire a Redis advisory lock (distributed mutex).
   *
   * Uses `SET key value NX PX ttlMs` under the hood. Returns `true`
   * when the lock was acquired by this call; returns `false` when
   * the key already exists (another replica holds the lock).
   *
   * @param key   Lock identifier (e.g. `tournament:cron:registration-open`).
   * @param ttlMs Lock auto-release time. Must be longer than the expected
   *              maximum execution time of the critical section to prevent
   *              a crashed replica from holding the lock indefinitely.
   *              Recommended: 2–5× the expected job duration.
   */
  acquireAdvisoryLock(key: string, ttlMs: number): Promise<boolean>;

  /**
   * Release a Redis advisory lock previously acquired by `acquireAdvisoryLock`.
   *
   * Only the holder should release the lock. Uses a Lua script to
   * atomically check-and-delete so that a concurrent critical section
   * cannot release a lock it doesn't own.
   *
   * @param key    Lock identifier.
   * @param token  Opaque value stored as the lock value (must be the
   *               same token returned by the corresponding `acquireAdvisoryLock` call).
   */
  releaseAdvisoryLock(key: string, token: string): Promise<boolean>;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
