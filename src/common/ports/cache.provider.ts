export interface CacheProvider {
  incrementWindowCounter(key: string, windowMs: number): Promise<number>;

  setIfNotExistsWithTtlSeconds(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  incrementCounterWithInitialTtlSeconds(key: string, ttlSeconds: number): Promise<number>;

  get(key: string): Promise<string | null>;

  set(key: string, value: string, ttlMs: number): Promise<void>;

  /**
   * Delete a key. Returns `true` if the key existed and was
   * deleted, `false` otherwise. Does not throw on missing keys.
   *
   * Used by single-shot consumers (e.g. socket-connection
   * metadata drains) where atomicity with the read is not
   * required.
   */
  del(key: string): Promise<boolean>;

  /**
   * Atomic read-and-delete. Returns the value the key held
   * before deletion, or `null` if the key did not exist.
   *
   * Implemented as the upstream Redis `GETDEL` command on
   * supported deployments, falling back to a Lua script
   * otherwise. Use this for any read-modify-delete that must not
   * race with a concurrent caller.
   */
  getDel(key: string): Promise<string | null>;

  /**
   * Remove every key matching the given glob pattern. Returns
   * the total number of keys that were unlinked.
   *
   * Implemented with `SCAN` (cursor-based, non-blocking) plus
   * `UNLINK` (reclaim memory asynchronously) — never `KEYS`,
   * which blocks the Redis main thread, and never `DEL`, which
   * blocks per-key. Both are wrapped in the shared circuit
   * breaker; if Redis is unavailable the call returns `0`
   * (fail-open) and emits no upstream traffic.
   *
   * Callers should pass a sufficiently-specific pattern (e.g.
   * `quiz:list:v1:*`) to bound the scan; pass a `batchSize` to
   * trade memory vs round-trips when the candidate set is
   * expected to be large.
   */
  unlinkByPattern(pattern: string, batchSize?: number): Promise<number>;

  /**
   * Gets a cached value or computes and caches it if missing.
   * @param key Redis key
   * @param ttlMs TTL in milliseconds
   * @param fetcher async function to compute the value if not cached
   */
  getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T>;

  /**
   * Gets a cached value with stampede protection.
   *
   * When the cache is cold (expired or missing), only one caller
   * executes the fetcher while others wait. This prevents the
   * "thundering herd" problem where many concurrent requests all
   * hit the database on a cache miss.
   *
   * How it works:
   * 1. Try to get the cached value
   * 2. If miss, try to acquire a short-lived "computing" lock (using SET NX)
   * 3. If lock acquired: execute fetcher, cache result, release lock
   * 4. If lock not acquired: wait briefly and retry the cache lookup
   *
   * @param key         Redis key for the cached value
   * @param ttlMs        TTL in milliseconds for the cached value
   * @param fetcher      Async function to compute the value if not cached
   * @param lockTtlMs    TTL for the computing lock (default: 5 seconds)
   * @param retryDelayMs Delay between retries while waiting for the lock (default: 50ms)
   * @param maxRetries   Maximum retries while waiting (default: 10)
   */
  getOrSetWithStampedeProtection<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    lockTtlMs?: number,
    retryDelayMs?: number,
    maxRetries?: number,
  ): Promise<T>;

  rpushJson<T>(key: string, item: T): Promise<number>;

  lpopJson<T>(key: string): Promise<T | null>;

  lrangeJson<T>(key: string, start: number, stop: number): Promise<T[]>;

  /**
   * Trim a Redis list to the inclusive range `[start, stop]`. Returns
   * the number of elements remaining in the list after the trim.
   *
   * Negative indices count from the end (`-1` is the last element).
   * `LTRIM key -100 -1` keeps the last 100 elements and discards the
   * rest — the canonical pattern for bounding a log / replay list.
   */
  trimList(key: string, start: number, stop: number): Promise<number>;

  /**
   * Return the length of the Redis list stored at `key`. Calls `LLEN`
   * and returns `0` for missing keys. Used by the retry-queue
   * observability probe to surface a per-tier gauge for the
   * dead-letter backlog.
   */
  listLength(key: string): Promise<number>;

  /**
   * Set a TTL (in seconds) on an existing key. Returns `true` when
   * the TTL was applied and `false` when the key did not exist.
   *
   * Used to refresh the TTL on every push to a bounded replay /
   * dead-letter list so that an idle key naturally expires.
   */
  expire(key: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Add a member to a sorted set with a numeric score. The score is
   * what makes the set useful for ordered dispatch: a member scored
   * at `nextRetryAt` is naturally retrieved in chronological order
   * by `zrangeByScore` and naturally excluded from "now" windows by
   * the score range.
   *
   * Returns the number of new members added (0 if it already existed
   * with the same score, 1 otherwise).
   */
  zaddByScore(key: string, score: number, member: string): Promise<number>;

  /**
   * Return up to `limit` members from a sorted set whose score is in
   * the inclusive range `[min, max]`. The members are returned in
   * ascending score order (oldest-due first). Each member is paired
   * with its score when `withScores` is true.
   *
   * Used to claim only the retry-queue items that are due right now
   * (`min = '-inf'`, `max = '<now>'`) without removing items that are
   * still in the future.
   */
  zrangeByScore(
    key: string,
    min: number | string,
    max: number | string,
    limit: number,
    withScores?: boolean,
  ): Promise<Array<{ member: string; score: number }>>;

  /**
   * Remove a single member from a sorted set. Returns `true` when
   * the member was removed and `false` when it was not present.
   *
   * Used in tandem with `getDel` to atomically claim a retry-queue
   * item: remove the index entry first, and only deliver the
   * payload if the removal succeeded (so a second worker that picked
   * up the same index entry sees nothing to claim).
   */
  zrem(key: string, member: string): Promise<boolean>;

  /**
   * Acquire a Redis advisory lock (distributed mutex).
   *
   * Uses `SET key value NX PX ttlMs` under the hood. Returns the lock
   * token when the lock was acquired by this call; returns `null` when
   * the key already exists (another replica holds the lock).
   *
   * The returned token MUST be passed to {@link releaseAdvisoryLock} so
   * the lock can only be released by the holder. This prevents a stale
   * replica that acquired the lock, had it expire (TTL), and then
   * resumed from inside the critical section from accidentally deleting
   * another replica's lock.
   *
   * @param key   Lock identifier (e.g. `tournament:cron:registration-open`).
   * @param ttlMs Lock auto-release time. Must be longer than the expected
   *              maximum execution time of the critical section to prevent
   *              a crashed replica from holding the lock indefinitely.
   *              Recommended: 2–5× the expected job duration.
   */
  acquireAdvisoryLock(key: string, ttlMs: number): Promise<string | null>;

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

  /**
   * Renew a held advisory lock by extending its TTL only if the caller
   * still owns it. Used by long-running cron jobs that must outlive the
   * initial lock TTL without losing their lease.
   *
   * Uses a Lua script to atomically check the value and PEXPIRE so a
   * lock whose token has already changed (re-acquired by another
   * replica after expiry) is not accidentally extended.
   *
   * Implementations without native lock renewal may return `false`
   * rather than throw; callers should treat `false` as "lost the lease"
   * and abort the critical section.
   */
  renewAdvisoryLock(key: string, token: string, ttlMs: number): Promise<boolean>;

  /**
   * Push an item to a list, trim it to a max size, and set TTL in one pipeline.
   * Used for dead-letter queue operations (RPUSH + LTRIM + EXPIRE).
   *
   * @param key           Redis key for the list
   * @param item          JSON-serializable item to push
   * @param maxLength     Maximum length to trim to (-N keeps last N items)
   * @param ttlSeconds    TTL to set on the key in seconds
   */
  pipelineDeadLetterPush<T>(
    key: string,
    item: T,
    maxLength: number,
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Execute multiple commands atomically as a Redis transaction (MULTI/EXEC).
   * Commands are pipelined; all succeed or none do.
   *
   * @param commands Array of `[commandName, ...args]` tuples.
   * @returns Array of command results in the same order.
   *
   * Used for atomic enqueue patterns where SET + ZADD must both succeed
   * or both be rolled back — eliminates orphaned payloads.
   */
  multiExec(commands: Array<[command: string, ...args: (string | number)[]]>): Promise<unknown[]>;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
