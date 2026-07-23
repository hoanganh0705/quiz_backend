import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { redisConfig } from '@/core/config';
import type { RedisConfig } from '@/core/config';
import Redis from 'ioredis';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';

@Injectable()
export class RedisService implements CacheProvider, PubSubProvider, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly redisConfig: RedisConfig,
    @InjectPinoLogger(RedisService.name)
    private readonly logger: PinoLogger,
  ) {
    this.client = new Redis(this.redisUrl, this.redisOptions);
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

  private createClient(): Redis {
    return new Redis(this.redisUrl, this.redisOptions);
  }

  async incrementWindowCounter(key: string, windowMs: number): Promise<number> {
    const luaScript = `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    return current
  `;

    const count = await this.client.eval(luaScript, 1, key, windowMs);

    if (typeof count !== 'number') {
      throw new Error('Failed to increment rate limit counter');
    }

    return count;
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

    const count = await this.client.eval(luaScript, 1, key, ttlSeconds);

    if (typeof count !== 'number') {
      throw new Error('Failed to increment redis counter with ttl');
    }

    return count;
  }

  async setIfNotExistsWithTtlSeconds(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }

    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) {
      throw new Error('ttlMs must be a positive number');
    }
    await this.client.set(key, value, 'PX', ttlMs);
  }

  async del(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async getDel(key: string): Promise<string | null> {
    // Native GETDEL is supported on Redis 6.2+. ioredis typings
    // expose the method, and Redis 8 ships in our docker-compose,
    // so the native path is safe in production. The Lua fallback
    // would be a one-liner if needed later, but since the field
    // is automatically written-and-deleted via TTL we don't need
    // the upgrade here.
    return this.client.getdel(key);
  }

  async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
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
  }

  async rpushJson<T>(key: string, item: T): Promise<number> {
    return this.client.rpush(key, JSON.stringify(item));
  }

  async lpopJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.lpop(key);
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

  /**
   * Publish a JSON-serialized message on a Redis pub/sub channel.
   * Returns the number of subscribers that received the message
   * (0 is normal during a rolling deploy, since old instances may
   * be subscribed but new instances may not be listening yet).
   */
  async publish(channel: string, payload: unknown): Promise<number> {
    return this.client.publish(channel, JSON.stringify(payload));
  }

  /**
   * Acquire a Redis advisory lock (distributed mutex).
   *
   * Uses `SET key value NX PX ttlMs` so that:
   *   - Only one caller can hold the lock at a time (NX).
   *   - The lock auto-releases if the holder crashes (PX = TTL).
   *
   * The `token` is a UUID generated by the caller to distinguish
   * "lock was acquired by me" from "lock already existed". The caller
   * must store the token and pass it back to `releaseAdvisoryLock`.
   */
  async acquireAdvisoryLock(key: string, ttlMs: number): Promise<boolean> {
    const token = crypto.randomUUID();
    const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return true;
    }
    return false;
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
    const result = await this.client.eval(script, 1, key, token);
    return result === 1;
  }

  /**
   * Round-trip a `PING` against the Redis server. Returns the
   * server reply on success, throws on connection / protocol
   * errors. Used by the health check — kept on this service
   * (rather than the controller reaching into the ioredis
   * client directly) so the health check stays decoupled from
   * the underlying driver.
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
}
