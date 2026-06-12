import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { CacheProvider } from '@/common/ports/cache.provider';

@Injectable()
export class RedisService implements CacheProvider, OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl || redisUrl.trim().length === 0) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }

    this.client = new Redis(redisUrl);
  }

  async incrementWindowCounter(key: string, windowMs: number): Promise<number> {
    // The Lua script atomically increments the counter and sets the expiration if it's the first increment
    const luaScript = `
    local current = redis.call("INCR", KEYS[1])
    if current == 1 then
      redis.call("PEXPIRE", KEYS[1], ARGV[1])
    end
    return current
  `;

    // execute the Lua script with the key and window duration in milliseconds as arguments
    // 1 indicates that there is one key being passed to the script, which is the rate limit key we want to increment and set expiration for
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
        // malformed cache entry, fall through to re-fetch
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
    return JSON.parse(raw) as T;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
