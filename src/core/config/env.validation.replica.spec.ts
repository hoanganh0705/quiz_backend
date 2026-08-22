/**
 * Phase 7 #3 — env validation tests for `DATABASE_READ_REPLICA_URL`.
 *
 * The variable is OPTIONAL — single-DB deployments must continue to
 * boot when the variable is absent. When set, the value must be a
 * `postgres://` or `postgresql://` URL.
 */

import { validateEnv } from './env.validation';

type ValidatedEnv = ReturnType<typeof validateEnv>;

const readReplica = (env: ValidatedEnv): string | null =>
  (env as unknown as { DATABASE_READ_REPLICA_URL?: string | null })
    .DATABASE_READ_REPLICA_URL ?? null;

describe('validateEnv — read-replica URL (Phase 7 #3)', () => {
  const baseEnv = (): Record<string, unknown> => ({
    DATABASE_URL: 'postgres://app:pw@localhost:5432/quizdb',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'a'.repeat(64),
    JWT_REFRESH_TOKEN_SECRET: 'b'.repeat(64),
    JWT_ACCESS_TOKEN_ISSUER: 'quiz-backend',
    JWT_ACCESS_TOKEN_AUDIENCE: 'quiz-client',
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    REFRESH_TOKEN_COOKIE_MAX_AGE_MS: '604800000',
    EMAIL_FROM_ADDRESS: 'noreply@example.com',
    EMAIL_FROM_NAME: 'Quiz',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test',
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    NODE_ENV: 'production',
    PORT: '3000',
  });

  it('returns null when the env var is absent', () => {
    const env = baseEnv();
    delete env.DATABASE_READ_REPLICA_URL;
    const result = validateEnv(env);
    expect(readReplica(result)).toBeNull();
  });

  it('accepts a postgres:// replica URL', () => {
    const env = baseEnv();
    env.DATABASE_READ_REPLICA_URL = 'postgres://app:pw@replica.example.com:5432/quizdb';
    const result = validateEnv(env);
    expect(readReplica(result)).toBe('postgres://app:pw@replica.example.com:5432/quizdb');
  });

  it('accepts a postgresql:// replica URL', () => {
    const env = baseEnv();
    env.DATABASE_READ_REPLICA_URL = 'postgresql://app:pw@replica.example.com:5432/quizdb';
    const result = validateEnv(env);
    expect(readReplica(result)).toBe('postgresql://app:pw@replica.example.com:5432/quizdb');
  });

  it('throws when the replica URL is not a valid postgres URL', () => {
    const env = baseEnv();
    env.DATABASE_READ_REPLICA_URL = 'mysql://app:pw@replica.example.com:3306/quizdb';
    expect(() => validateEnv(env)).toThrow(/DATABASE_READ_REPLICA_URL/);
  });
});
