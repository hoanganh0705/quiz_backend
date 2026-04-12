import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
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

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
