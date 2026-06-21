/**
 * Redis configuration.
 * Provides typed access to Redis-related environment variables.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? '',
}));

export type RedisConfig = ConfigType<typeof redisConfig>;
