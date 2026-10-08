import { validateEnv } from './env.validation';

type ValidatedEnv = ReturnType<typeof validateEnv>;

const readRedisKeyPrefix = (env: ValidatedEnv): string =>
  (env as unknown as { REDIS_KEY_PREFIX: string }).REDIS_KEY_PREFIX;

const baseEnv = (): Record<string, unknown> => ({
  DATABASE_URL: 'postgres://app:pw@localhost:5432/quizdb',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz01',
  JWT_REFRESH_TOKEN_SECRET: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz10',
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
  CLOUDINARY_FOLDER: 'quiz-app-prod',
  PORT: '3000',
  CORS_ORIGINS: 'https://app.example.com',
  PROMETHEUS_SCRAPE_TOKEN: 'test-prometheus-token',
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
});

describe('validateEnv — REDIS_KEY_PREFIX (production)', () => {
  it('requires a non-empty prefix in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    delete env.REDIS_KEY_PREFIX;
    expect(() => validateEnv(env)).toThrow(/REDIS_KEY_PREFIX/);
  });

  it('rejects an explicitly empty prefix in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.REDIS_KEY_PREFIX = '';
    expect(() => validateEnv(env)).toThrow(/REDIS_KEY_PREFIX/);
  });

  it('rejects a whitespace-only prefix in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.REDIS_KEY_PREFIX = '   ';
    expect(() => validateEnv(env)).toThrow(/REDIS_KEY_PREFIX/);
  });

  it('accepts any non-empty prefix in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.REDIS_KEY_PREFIX = 'prod:';
    const result = validateEnv(env);
    expect(readRedisKeyPrefix(result)).toBe('prod:');
  });
});

describe('validateEnv — REDIS_KEY_PREFIX (development defaults)', () => {
  it('defaults to "dev:" when not set in development', () => {
    const env = baseEnv();
    env.NODE_ENV = 'development';
    delete env.REDIS_KEY_PREFIX;
    const result = validateEnv(env);
    expect(readRedisKeyPrefix(result)).toBe('dev:');
  });

  it('accepts an explicit prefix in development', () => {
    const env = baseEnv();
    env.NODE_ENV = 'development';
    env.REDIS_KEY_PREFIX = 'shared:';
    const result = validateEnv(env);
    expect(readRedisKeyPrefix(result)).toBe('shared:');
  });
});

describe('validateEnv — REDIS_KEY_PREFIX (test defaults)', () => {
  it('defaults to "test:" when not set in test', () => {
    const env = baseEnv();
    env.NODE_ENV = 'test';
    delete env.REDIS_KEY_PREFIX;
    const result = validateEnv(env);
    expect(readRedisKeyPrefix(result)).toBe('test:');
  });
});
