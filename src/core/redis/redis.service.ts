import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { redisConfig } from '@/core/config';
import type { RedisConfig } from '@/core/config';
import Redis, { type RedisOptions } from 'ioredis';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';
import type { RedisCircuitPort, RedisCircuitState } from '@/common/ports/redis-circuit.port';
import type { ThrottlerCachePort } from '@/common/ports/throttler-cache.port';
import { RedisCircuitBreaker } from './redis-circuit-breaker';
import { THROTTLER_INCREMENT_LUA } from '@/core/throttler/redis-throttler.storage';
import { RedisTracingWrapper } from '@/core/observability/redis-tracing.wrapper';

/**
 * Redis-backed implementation of every Redis-touching port.
 *
 * ## Circuit-breaker fallback semantics
 *
 * Every method on this service routes through {@link RedisCircuitBreaker.exec}
 * with an explicit fallback value. The fallbacks are deliberately tuned so
 * that a Redis outage degrades the product predictably rather than surfacing
 * 500s to the client.
 *
 * | Method | Fallback value | Consumer impact |
 * |--------|----------------|-----------------|
 * | `get(key)` | `null` | Cache miss. Caller falls through to the source of truth (database / repository). Reads degrade to non-cached behaviour. |
 * | `set(key, value, ttlMs)` | `undefined` | Write discarded. Subsequent reads will repopulate from source on miss. No data loss because the source of truth is unchanged. |
 * | `del(key)` | `false` | Stale entries linger until their TTL expires. Acceptable because all cache invalidations use TTL as a backstop and version bumps expose new keys. |
 * | `getdel(key)` | `null` | Caller treats it as an absent value; queue / replay consumers re-fetch from the source. |
 * | `setIfNotExistsWithTtlSeconds(key, value, ttl)` | `false` | Adopts "lock already taken" semantics — duplicates are rejected rather than allowed through during outage. |
 * | `incrementWindowCounter(key, windowMs)` | `0` | Per-bucket rate limiter treats the request as the first in its window (fail-open). Brief permissive window during outage. |
 * | `incrementCounterWithInitialTtlSeconds` | `0` | Social feed throttle counter resets. Subsequent writes are not blocked by stale state. |
 * | `incrementWindowCounterWithPttl` | `{count:0, pttlMs:-2}` | Throttler treats it as "no recent activity" → request allowed (fail-open). Counter resumes once Redis recovers. |
 * | `getOrSet*`, `getOrSetWithStampedeProtection` | Cache-miss fallback (runs the loader function with cache still absent) | Caller still serves a freshly-loaded value; misses are no worse than the uncached path. |
 * | `rpushJson` / `lpopJson` / `lrangeJson` / `trimList` / `listLength` | `0` / `null` / `[]` / `0` / `0` | Replay queue behaves as if empty. Observability probes report zero backlog during outage. |
 * | `expire(key, ttlSeconds)` | `false` | Key keeps existing TTL (or no TTL). Caller treats as best-effort. |
 * | `zaddByScore` / `zrangeByScore` / `zrem` | `0` / `[]` / `false` | Sorted-set helpers behave as no-ops during outage. Leadership / ranking writes retry on the next interval. |
 * | `publish(channel, payload)` | `0` | Pub/sub event lost. Consuming instance must rely on TTL refresh + replay list (see `CommonExternalEventBus` / `SessionInvalidationBus`). |
 * | `acquireAdvisoryLock` | `null` | Scheduler skips work for this cycle; the next cron tick retries. Caller must log + increment skip metric. |
 * | `releaseAdvisoryLock` | `false` | Best-effort; lock TTL guarantees eventual freeing even if release fails. |
 * | `ping()` | NOT WRAPPED | The health endpoint receives a real probe; without this, the breaker would mask recovery. |
 *
 * Consumers that need a different policy (e.g. fail-closed throttling) MUST
 * inspect the result and escalate before treating it as a normal miss.
 * {@link `RedisCircuitOpenError`} is the canonical signal that the fallback
 * is in effect.
 *
 * ## Cache key namespace index
 *
 * Every Redis key touched by this service carries one of the prefixes
 * below. Modules write to (and read from) their own namespace; cross-module
 * collisions are prevented by convention rather than enforced by the
 * service.
 *
 * | Prefix | Module | Purpose |
 * |--------|--------|---------|
 * | `achievement:cache:` | `modules/achievement` | Badge + rule caches (60s TTL). |
 * | `auth:rate_limit:` | `modules/auth` | Security service rate-limit counters (`incrementWindowCounter`). |
 * | `auth:refresh_reuse:` | `modules/auth` | Refresh-token reuse detector (JTIs). |
 * | `bookmark:collection:` | `modules/bookmark` | Collection analytics (30 min TTL). |
 * | `lb:` | `modules/ranking` | Short prefix used by `LeaderboardService` for leaderboard zset entries. |
 * | `pos:` | `modules/ranking` | Short prefix used by `LeaderboardService.getUserPosition` cache. |
 * | `total:` | `modules/ranking` | Short prefix for the total-active-users counter. |
 * | `notif:prefs` | `modules/notification` | Per-user notification preferences (sentinel `'null'` for cache-as-absent). |
 * | `session:invalidate:` | `modules/auth` | Session-invalidation replay list. |
 * | `tag:ranking:` | `modules/tag` | Popular / trending tag rankings + version key. |
 * | `throttler:` | `core/throttler` | Fleet-wide rate-limit counter for NestJS ThrottlerModule. |
 * | `user:profile:` | `modules/user` | Profile-bundle cache (10s TTL). |
 * | `quiz:` | `modules/quiz` | Quiz detail + collection caches; invalidated by events. |
 * | `tournament:` | `modules/tournament` | BullMQ queue via `keyPrefix` aware connection. |
 * | `email:` | `modules/email` | BullMQ queue via `keyPrefix` aware connection. |
 *
 * Lock keys suffix `:lock` on the corresponding namespace and use the same
 * advisory-lock Lua script (`acquireAdvisoryLock`).
 */
@Injectable()
export class RedisService
  implements CacheProvider, PubSubProvider, RedisCircuitPort, ThrottlerCachePort, OnModuleDestroy
{
  /**
   * Shared ioredis connection used by every `CacheProvider` /
   * `PubSubProvider` call.
   *
   * **Do not call blocking commands on this client** (`BLPOP`,
   * `BRPOP`, `BLMPOP`, `WAIT`, `XREAD`, `XREADGROUP`, ...). Blocking
   * ties up the single shared connection and stalls every other
   * Redis caller on the same instance.
   *
   * Callers that need blocking semantics MUST obtain a dedicated
   * connection via `createSubscriber()` / `createClient()` and own
   * its lifecycle (call `quit()` on shutdown).
   *
   * The `no-blocking-redis-on-shared-client` ESLint rule enforces
   * this contract for `src/core/redis/redis.service.ts`.
   */
  private readonly client: Redis;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redisConfig: RedisConfig,
    @InjectPinoLogger(RedisService.name)
    private readonly logger: PinoLogger,
    private readonly circuitBreaker: RedisCircuitBreaker,
    @Optional()
    private readonly tracingWrapper?: RedisTracingWrapper,
  ) {
    const rawClient = new Redis(this.redisUrl, this.redisOptionsWithPrefix);
    this.client = this.tracingWrapper ? this.tracingWrapper.wrap(rawClient) : rawClient;
  }

  private get redisUrl(): string {
    const url = this.redisConfig.url;

    if (!url || url.trim().length === 0) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }

    return url;
  }

  private readonly redisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 1000);
    },
  };

  private get redisOptionsWithPrefix(): RedisOptions {
    const prefix = this.redisConfig.keyPrefix;
    return {
      ...this.redisOptions,
      ...(prefix ? { keyPrefix: prefix } : {}),
    };
  }

  private createClient(): Redis {
    return new Redis(this.redisUrl, this.redisOptionsWithPrefix);
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  getCircuitState(): RedisCircuitState {
    const state = this.circuitBreaker.getMetrics().state;
    return state === 'half-open' ? 'half_open' : state;
  }

  async incrementWindowCounter(key: string, windowMs: number): Promise<number> {
    const luaScript = `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    return current
  `;

    return this.circuitBreaker.exec(0, async () => {
      const count = await this.client.eval(luaScript, 1, key, windowMs);

      if (typeof count !== 'number') {
        throw new Error('Failed to increment rate limit counter');
      }

      return count;
    });
  }

  async incrementWindowCounterWithPttl(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; pttlMs: number }> {
    return this.circuitBreaker.exec({ count: 0, pttlMs: -2 } as const, async () => {
      const result = await this.client.eval(THROTTLER_INCREMENT_LUA, 1, key, windowMs);

      if (!Array.isArray(result) || result.length !== 2) {
        throw new Error('Failed to increment throttler counter with PTTL');
      }

      const rawCount = result[0];
      const rawPttl = result[1];
      if (typeof rawCount !== 'number' || typeof rawPttl !== 'number') {
        throw new Error('Failed to increment throttler counter with PTTL');
      }

      return { count: rawCount, pttlMs: rawPttl };
    });
  }

  async incrementCounterWithInitialTtlSeconds(key: string, ttlSeconds: number): Promise<number> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }

    const luaScript = `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end
    return current
  `;

    return this.circuitBreaker.exec(0, async () => {
      const count = await this.client.eval(luaScript, 1, key, ttlSeconds);

      if (typeof count !== 'number') {
        throw new Error('Failed to increment redis counter with ttl');
      }

      return count;
    });
  }

  async setIfNotExistsWithTtlSeconds(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }

    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    });
  }

  async get(key: string): Promise<string | null> {
    return this.circuitBreaker.exec(null, async () => this.client.get(key));
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) {
      throw new Error('ttlMs must be a positive number');
    }
    await this.circuitBreaker.exec(undefined, async () => {
      await this.client.set(key, value, 'PX', ttlMs);
    });
  }

  async del(key: string): Promise<boolean> {
    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.del(key);
      return result > 0;
    });
  }

  async getDel(key: string): Promise<string | null> {
    return this.circuitBreaker.exec(null, async () => this.client.getdel(key));
  }

  async unlinkByPattern(pattern: string, batchSize: number = 100): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error('batchSize must be a positive integer');
    }

    return this.circuitBreaker.exec(0, async () => {
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, batch] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          batchSize,
        );

        if (batch.length > 0) {
          const removed = await this.client.unlink(...batch);
          deleted += Number(removed) || 0;
        }

        cursor = nextCursor;
      } while (cursor !== '0');

      return deleted;
    });
  }

  async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.exec(undefined as unknown as T, async () => {
      const cached = await this.get(key);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          this.logger.warn({
            event: 'redis_cache_parse_failed',
            key,
          });
        }
      }

      const value = await fetcher();
      await this.set(key, JSON.stringify(value), ttlMs);
      return value;
    });
  }

  /**
   * Gets a cached value with stampede protection.
   *
   * When the cache is cold (expired or missing), only one caller
   * executes the fetcher while others wait. This prevents the
   * "thundering herd" problem where many concurrent requests all
   * hit the database on a cache miss.
   */
  async getOrSetWithStampedeProtection<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    lockTtlMs = 5000,
    retryDelayMs = 50,
    maxRetries = 10,
  ): Promise<T> {
    // First, try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        this.logger.warn({
          event: 'redis_cache_parse_failed',
          key,
        });
      }
    }

    // Cache miss - try to acquire the computing lock
    const lockKey = `${key}:computing`;
    const lockAcquired = await this.client.set(lockKey, '1', 'PX', lockTtlMs, 'NX');

    if (lockAcquired) {
      // We got the lock - we're responsible for computing and caching
      try {
        const value = await fetcher();
        await this.set(key, JSON.stringify(value), ttlMs);
        return value;
      } finally {
        // Release the lock
        await this.client.del(lockKey);
      }
    }

    // Another process is computing - wait and retry cache lookup
    for (let i = 0; i < maxRetries; i++) {
      await this.sleep(retryDelayMs);

      const retryCached = await this.get(key);
      if (retryCached !== null) {
        try {
          return JSON.parse(retryCached) as T;
        } catch {
          this.logger.warn({
            event: 'redis_cache_parse_failed_retry',
            key,
            attempt: i + 1,
          });
        }
      }
    }

    // Timeout waiting for other process - compute ourselves
    this.logger.warn({
      event: 'redis_cache_stampede_timeout',
      key,
      retries: maxRetries,
    });

    const value = await fetcher();
    await this.set(key, JSON.stringify(value), ttlMs);
    return value;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async rpushJson<T>(key: string, item: T): Promise<number> {
    return this.circuitBreaker.exec(0, async () => this.client.rpush(key, JSON.stringify(item)));
  }

  async lpopJson<T>(key: string): Promise<T | null> {
    const raw = await this.circuitBreaker.exec(null, async () => this.client.lpop(key));
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn({
        event: 'redis_json_parse_failed',
        key,
        payloadLength: raw.length,
        message: 'Failed to parse JSON from Redis list',
      });
      return null;
    }
  }

  async lrangeJson<T>(key: string, start: number, stop: number): Promise<T[]> {
    const raws = await this.circuitBreaker.exec([] as string[], async () =>
      this.client.lrange(key, start, stop),
    );
    const items: T[] = [];
    for (const raw of raws) {
      try {
        items.push(JSON.parse(raw) as T);
      } catch {
        this.logger.warn({
          event: 'redis_json_parse_failed',
          key,
          payloadLength: raw.length,
          message: 'Failed to parse JSON from Redis list (lrange)',
        });
      }
    }
    return items;
  }

  async trimList(key: string, start: number, stop: number): Promise<number> {
    return this.circuitBreaker.exec(0, async () => {
      await this.client.ltrim(key, start, stop);
      return this.client.llen(key);
    });
  }

  async listLength(key: string): Promise<number> {
    return this.circuitBreaker.exec(0, async () => this.client.llen(key));
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }
    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    });
  }

  async zaddByScore(key: string, score: number, member: string): Promise<number> {
    return this.circuitBreaker.exec(0, async () => {
      const result = await this.client.zadd(key, score, member);
      return Number(result) || 0;
    });
  }

  async zrangeByScore(
    key: string,
    min: number | string,
    max: number | string,
    limit: number,
    withScores = false,
  ): Promise<Array<{ member: string; score: number }>> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('limit must be a positive integer');
    }
    const minArg = typeof min === 'number' ? min.toString() : min;
    const maxArg = typeof max === 'number' ? max.toString() : max;

    return this.circuitBreaker.exec([] as Array<{ member: string; score: number }>, async () => {
      const raw = withScores
        ? await this.client.zrangebyscore(key, minArg, maxArg, 'WITHSCORES', 'LIMIT', 0, limit)
        : await this.client.zrangebyscore(key, minArg, maxArg, 'LIMIT', 0, limit);

      if (!withScores) {
        return raw.map((member) => ({ member, score: 0 }));
      }

      const pairs = raw;
      const out: Array<{ member: string; score: number }> = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const member = pairs[i] ?? '';
        const scoreRaw = pairs[i + 1] ?? '0';
        out.push({ member, score: Number(scoreRaw) || 0 });
      }
      return out;
    });
  }

  async zrem(key: string, member: string): Promise<boolean> {
    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.zrem(key, member);
      return result === 1;
    });
  }

  /**
   * Publish a JSON-serialized message on a Redis pub/sub channel.
   * Returns the number of subscribers that received the message
   * (0 is normal during a rolling deploy, since old instances may
   * be subscribed but new instances may not be listening yet).
   */
  async publish(channel: string, payload: unknown): Promise<number> {
    return this.circuitBreaker.exec(0, async () =>
      this.client.publish(channel, JSON.stringify(payload)),
    );
  }

  /**
   * Acquire a Redis advisory lock (distributed mutex).
   *
   * Uses `SET key value NX PX ttlMs` so that:
   *   - Only one caller can hold the lock at a time (NX).
   *   - The lock auto-releases if the holder crashes (PX = TTL).
   *
   * Returns the unique `token` (a UUID) when the lock was acquired
   * by this call. Returns `null` when the key already exists (another
   * replica holds the lock). The caller MUST pass the token back to
   * {@link releaseAdvisoryLock} to safely release the lock.
   */
  async acquireAdvisoryLock(key: string, ttlMs: number): Promise<string | null> {
    const token = crypto.randomUUID();
    return this.circuitBreaker.exec(null, async () => {
      const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    });
  }

  /**
   * Release a Redis advisory lock.
   *
   * Uses a Lua script for atomic check-and-delete so that:
   *   - If the token matches: DELETE the key and return true.
   *   - If the token does not match (another replica acquired the lock
   *     after our TTL expired and we somehow called release): return false.
   *
   * This prevents a slow release from accidentally deleting a fresh lock
   * held by a newly-elected leader.
   */
  async releaseAdvisoryLock(key: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.eval(script, 1, key, token);
      return result === 1;
    });
  }

  async renewAdvisoryLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    return this.circuitBreaker.exec(false, async () => {
      const result = await this.client.eval(script, 1, key, token, String(ttlMs));
      return result === 1;
    });
  }

  async multiExec(
    commands: Array<[command: string, ...args: (string | number)[]]>,
  ): Promise<unknown[]> {
    return this.circuitBreaker.exec([], async () => {
      const pipeline = this.client.multi();
      for (const [command, ...args] of commands) {
        (pipeline as unknown as Record<string, (...a: unknown[]) => typeof pipeline>)[command](
          ...args,
        );
      }
      const results = await pipeline.exec();
      if (results === null) return [];
      return results.map((r) => (r?.[0] instanceof Error ? null : (r?.[1] ?? null)));
    });
  }

  /**
   * Round-trip a `PING` against the Redis server. Returns the
   * server reply on success, throws on connection / protocol
   * errors. Used by the health check — kept on this service
   * (rather than the controller reaching into the ioredis
   * client directly) so the health check stays decoupled from
   * the underlying driver.
   *
   * Note: `ping` is intentionally NOT wrapped by the circuit
   * breaker. The health endpoint needs a real probe so the
   * operator can see whether Redis is actually back up after the
   * breaker opened. Letting the breaker swallow the `ping` error
   * would mask recovery.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * Create a dedicated subscriber connection. Pub/sub blocks
   * the connection from running normal commands, so subscribers
   * must use a separate client. Callers are responsible for
   * calling `subscriber.quit()` on shutdown.
   */
  createSubscriber(): Redis {
    return this.createClient();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async pipelineDeadLetterPush<T>(
    key: string,
    item: T,
    maxLength: number,
    ttlSeconds: number,
  ): Promise<void> {
    await this.circuitBreaker.exec(undefined, async () => {
      const pipeline = this.client.pipeline();
      pipeline.rpush(key, JSON.stringify(item));
      pipeline.ltrim(key, -maxLength, -1);
      pipeline.expire(key, ttlSeconds);
      await pipeline.exec();
    });
  }
}
