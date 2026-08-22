/**
 * Redis configuration.
 * Provides typed access to Redis-related environment variables.
 *
 * Note: REDIS_URL is validated at startup via validateEnv() in env.validation.ts,
 * which guarantees a non-empty, valid redis:// or rediss:// URL.
 *
 * Phase 2 #1 — circuit-breaker tunables. The defaults match the
 * proven values used by the email circuit breaker: 5 consecutive
 * failures to open, 30 seconds of cool-down before the next probe.
 * Override via env vars when running against a flaky Redis replica
 * (e.g. REDIS_CIRCUIT_FAILURE_THRESHOLD=3 REDIS_CIRCUIT_RESET_TIMEOUT_MS=10000).
 */
import { ConfigType, registerAs } from '@nestjs/config';

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Redis circuit value must be a positive integer, got '${raw}'`);
  }
  return parsed;
};

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? '',
  circuit: {
    failureThreshold: parsePositiveInt(
      process.env.REDIS_CIRCUIT_FAILURE_THRESHOLD,
      5,
    ),
    resetTimeoutMs: parsePositiveInt(
      process.env.REDIS_CIRCUIT_RESET_TIMEOUT_MS,
      30_000,
    ),
  },
}));

export type RedisConfig = ConfigType<typeof redisConfig>;