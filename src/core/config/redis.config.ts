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

const parseRedisKeyPrefixFromEnv = (): string => {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const fallback = isTest ? 'test:' : 'dev:';

  const raw = process.env.REDIS_KEY_PREFIX;
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value.length === 0) {
    if (isProduction) {
      throw new Error('REDIS_KEY_PREFIX must be a non-empty string in production');
    }
    return fallback;
  }
  if (/\s/.test(value)) {
    throw new Error('REDIS_KEY_PREFIX must not contain whitespace');
  }
  return value;
};

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? '',
  keyPrefix: parseRedisKeyPrefixFromEnv(),
  circuit: {
    failureThreshold: parsePositiveInt(process.env.REDIS_CIRCUIT_FAILURE_THRESHOLD, 5),
    resetTimeoutMs: parsePositiveInt(process.env.REDIS_CIRCUIT_RESET_TIMEOUT_MS, 30_000),
  },
}));

export type RedisConfig = ConfigType<typeof redisConfig>;
