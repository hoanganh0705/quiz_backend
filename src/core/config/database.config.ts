/**
 * Database configuration.
 *
 * Provides typed access to database-related environment variables.
 *
 * Phase 1 #4 — connection pool tuning. The defaults follow the
 * `node-postgres` guidance: `max = 10 × CPU cores` is the upper bound
 * PostgreSQL itself can comfortably serve, and `idleTimeoutMillis` keeps
 * idle connections from holding the WAL receiver open indefinitely.
 *
 * Override via environment variables when running against a constrained
 * Postgres instance (e.g. PgBouncer with `pool_size = 5` upstream):
 *
 *   DATABASE_POOL_MAX=20
 *   DATABASE_POOL_IDLE_TIMEOUT_MS=30000
 *   DATABASE_POOL_CONNECTION_TIMEOUT_MS=10000
 *   DATABASE_POOL_STATEMENT_TIMEOUT_MS=30000
 */
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
    throw new Error(
      `Database pool value must be a positive integer, got '${raw}'`,
    );
  }
  return parsed;
};

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  // Phase 7 #3 — when set, read-only traffic uses this URL. Read
  // endpoints that opt in via @Inject(DRIZZLE_READ) get a Drizzle
  // client bound to this pool. We treat the value as a string here
  // because `registerAs` consumers may pass `process.env.DATABASE_READ_REPLICA_URL`
  // directly; the value is already validated by `validateEnv()` and
  // is `null` when unset.
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