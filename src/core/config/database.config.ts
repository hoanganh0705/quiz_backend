import { ConfigType, registerAs } from '@nestjs/config';

const DEFAULT_POOL_MAX = 10;
const DEFAULT_POOL_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_POOL_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_POOL_STATEMENT_TIMEOUT_MS = 30_000;

const parseOptionalPositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Database pool value must be a positive integer, got '${raw}'`);
  }
  return parsed;
};

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL || null,
  pool: {
    max: parseOptionalPositiveInt(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    idleTimeoutMillis: parseOptionalPositiveInt(
      process.env.DATABASE_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_POOL_IDLE_TIMEOUT_MS,
    ),
    connectionTimeoutMillis: parseOptionalPositiveInt(
      process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
    ),
    statementTimeoutMs: parseOptionalPositiveInt(
      process.env.DATABASE_POOL_STATEMENT_TIMEOUT_MS,
      DEFAULT_POOL_STATEMENT_TIMEOUT_MS,
    ),
  },
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
