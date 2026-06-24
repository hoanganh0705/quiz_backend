import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { redisConfig } from '@/core/config';
import type { RedisConfig } from '@/core/config';
import Redis from 'ioredis';
import type { CacheProvider } from '@/common/ports/cache.provider';

@Injectable()
export class RedisService implements CacheProvider, OnModuleDestroy {
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
   *
   * Used by the session-invalidation bus to broadcast revocation
   * events across all API instances.
   */
  async publish(channel: string, payload: unknown): Promise<number> {
    return this.client.publish(channel, JSON.stringify(payload));
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
