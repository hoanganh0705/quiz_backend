/**
 * Redis configuration.
 * Provides typed access to Redis-related environment variables.
 *
 * Note: REDIS_URL is validated at startup via validateEnv() in env.validation.ts,
 * which guarantees a non-empty, valid redis:// or rediss:// URL.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? '',
}));

export type RedisConfig = ConfigType<typeof redisConfig>;
