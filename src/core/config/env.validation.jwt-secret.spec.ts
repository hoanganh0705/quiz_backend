import { validateEnv } from './env.validation';

const baseEnv = (): Record<string, unknown> => ({
  DATABASE_URL: 'postgres://app:pw@localhost:5432/quizdb',
  REDIS_URL: 'redis://localhost:6379',
  REDIS_KEY_PREFIX: 'test',
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
  CLOUDINARY_CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_FOLDER: 'quiz-app-prod',
  NODE_ENV: 'production',
  PORT: '3000',
  CORS_ORIGINS: 'https://app.example.com',
  PROMETHEUS_SCRAPE_TOKEN: 'test-prometheus-token',
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
});

describe('validateEnv — JWT secret entropy', () => {
  it('accepts a 64-char secret with diverse characters', () => {
    const env = baseEnv();
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects an access-token secret that is 31 characters long', () => {
    const env = baseEnv();
    env.JWT_ACCESS_TOKEN_SECRET = 'a'.repeat(31);
    expect(() => validateEnv(env)).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('rejects a refresh-token secret that is 31 characters long', () => {
    const env = baseEnv();
    env.JWT_REFRESH_TOKEN_SECRET = 'b'.repeat(31);
    expect(() => validateEnv(env)).toThrow(/JWT_REFRESH_TOKEN_SECRET/);
  });

  it('rejects a 32-character secret with all identical characters', () => {
    const env = baseEnv();
    env.JWT_ACCESS_TOKEN_SECRET = 'a'.repeat(32);
    expect(() => validateEnv(env)).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('rejects a 32-character secret with only 8 unique characters', () => {
    const env = baseEnv();
    env.JWT_ACCESS_TOKEN_SECRET = 'abcdefgh'.repeat(4);
    expect(() => validateEnv(env)).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('accepts a base64-encoded secret of sufficient length and entropy', () => {
    const env = baseEnv();
    const secret = Buffer.from('aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/=', 'utf8').toString(
      'base64',
    );
    expect(secret.length).toBeGreaterThanOrEqual(32);
    env.JWT_ACCESS_TOKEN_SECRET = secret;
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('still requires both secrets to satisfy entropy independently', () => {
    const env = baseEnv();
    env.JWT_REFRESH_TOKEN_SECRET = 'a'.repeat(32);
    expect(() => validateEnv(env)).toThrow(/JWT_REFRESH_TOKEN_SECRET/);
  });
});

describe('validateEnv — CORS_ORIGINS in production', () => {
  const productionEnv = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    DATABASE_URL: 'postgres://app:pw@localhost:5432/quizdb',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_KEY_PREFIX: 'prod:',
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
    NODE_ENV: 'production',
    PORT: '3000',
    CORS_ORIGINS: 'https://app.example.com',
    PROMETHEUS_SCRAPE_TOKEN: 'test-prometheus-token',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    ...overrides,
  });

  it('throws when CORS_ORIGINS is unset in production', () => {
    const env = productionEnv();
    delete env.CORS_ORIGINS;
    expect(() => validateEnv(env)).toThrow(/CORS_ORIGINS/);
  });

  it('throws when CORS_ORIGINS is the empty string in production', () => {
    const env = productionEnv();
    env.CORS_ORIGINS = '';
    expect(() => validateEnv(env)).toThrow(/CORS_ORIGINS/);
  });

  it('throws when CORS_ORIGINS contains only commas / whitespace in production', () => {
    const env = productionEnv();
    env.CORS_ORIGINS = ', , ,';
    expect(() => validateEnv(env)).toThrow(/CORS_ORIGINS/);
  });

  it('accepts a single origin in production', () => {
    const env = productionEnv();
    env.CORS_ORIGINS = 'https://app.example.com';
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('accepts a comma-separated list of origins in production', () => {
    const env = productionEnv();
    env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('does not enforce the CORS_ORIGINS requirement in development', () => {
    const env = productionEnv({ NODE_ENV: 'development' });
    delete env.CORS_ORIGINS;
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('does not enforce the CORS_ORIGINS requirement in test', () => {
    const env = productionEnv({ NODE_ENV: 'test' });
    delete env.CORS_ORIGINS;
    expect(() => validateEnv(env)).not.toThrow();
  });
});

describe('validateEnv — PROMETHEUS_SCRAPE_TOKEN in production', () => {
  const productionEnv = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    DATABASE_URL: 'postgres://app:pw@localhost:5432/quizdb',
    REDIS_URL: 'redis://localhost:6379',
    REDIS_KEY_PREFIX: 'prod:',
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
    NODE_ENV: 'production',
    PORT: '3000',
    CORS_ORIGINS: 'https://app.example.com',
    PROMETHEUS_SCRAPE_TOKEN: 'test-prometheus-token',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    ...overrides,
  });

  it('throws when PROMETHEUS_SCRAPE_TOKEN is unset in production', () => {
    const env = productionEnv();
    delete env.PROMETHEUS_SCRAPE_TOKEN;
    expect(() => validateEnv(env)).toThrow(/PROMETHEUS_SCRAPE_TOKEN/);
  });

  it('throws when PROMETHEUS_SCRAPE_TOKEN is the empty string in production', () => {
    const env = productionEnv();
    env.PROMETHEUS_SCRAPE_TOKEN = '';
    expect(() => validateEnv(env)).toThrow(/PROMETHEUS_SCRAPE_TOKEN/);
  });

  it('accepts a non-empty token in production', () => {
    const env = productionEnv();
    env.PROMETHEUS_SCRAPE_TOKEN = 'super-secret-token';
    const result = validateEnv(env);
    expect(result.PROMETHEUS_SCRAPE_TOKEN).toBe('super-secret-token');
  });

  it('does not enforce the token requirement in development', () => {
    const env = productionEnv({ NODE_ENV: 'development' });
    delete env.PROMETHEUS_SCRAPE_TOKEN;
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('does not enforce the token requirement in test', () => {
    const env = productionEnv({ NODE_ENV: 'test' });
    delete env.PROMETHEUS_SCRAPE_TOKEN;
    expect(() => validateEnv(env)).not.toThrow();
  });
});
