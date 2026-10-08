import { validateEnv } from './env.validation';

describe('validateEnv — CLOUDINARY_FOLDER', () => {
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
    CLOUDINARY_API_SECRET: 'secret',
    PORT: '3000',
    GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  });

  it('defaults to quiz-app-dev in non-production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'development';
    const result = validateEnv(env);
    expect(result.CLOUDINARY_FOLDER).toBe('quiz-app-dev');
  });

  it('accepts quiz-app-dev in development', () => {
    const env = baseEnv();
    env.NODE_ENV = 'development';
    env.CLOUDINARY_FOLDER = 'quiz-app-dev';
    const result = validateEnv(env);
    expect(result.CLOUDINARY_FOLDER).toBe('quiz-app-dev');
  });

  it('accepts a non-default folder in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.CORS_ORIGINS = 'https://app.example.com';
    env.PROMETHEUS_SCRAPE_TOKEN = 'test-prometheus-token';
    env.CLOUDINARY_FOLDER = 'quiz-app-prod';
    const result = validateEnv(env);
    expect(result.CLOUDINARY_FOLDER).toBe('quiz-app-prod');
  });

  it('rejects the dev default in production', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.CORS_ORIGINS = 'https://app.example.com';
    env.PROMETHEUS_SCRAPE_TOKEN = 'test-prometheus-token';
    env.CLOUDINARY_FOLDER = 'quiz-app-dev';
    expect(() => validateEnv(env)).toThrow(/CLOUDINARY_FOLDER/);
  });

  it('rejects the dev default when omitted in production (falls back to dev default)', () => {
    const env = baseEnv();
    env.NODE_ENV = 'production';
    env.CORS_ORIGINS = 'https://app.example.com';
    env.PROMETHEUS_SCRAPE_TOKEN = 'test-prometheus-token';
    expect(() => validateEnv(env)).toThrow(/CLOUDINARY_FOLDER/);
  });
});
