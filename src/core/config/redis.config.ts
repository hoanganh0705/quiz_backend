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
    failureThreshold: parsePositiveInt(process.env.REDIS_CIRCUIT_FAILURE_THRESHOLD, 5),
    resetTimeoutMs: parsePositiveInt(process.env.REDIS_CIRCUIT_RESET_TIMEOUT_MS, 30_000),
  },
}));

export type RedisConfig = ConfigType<typeof redisConfig>;
