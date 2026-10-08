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
  CLOUDINARY_API_SECRET: 'secret',
  CLOUDINARY_FOLDER: 'quiz-app-prod',
  NODE_ENV: 'production',
  PORT: '3000',
  CORS_ORIGINS: 'https://app.example.com',
  PROMETHEUS_SCRAPE_TOKEN: 'test-prometheus-token',
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
});

describe('validateEnv — newly-added keys', () => {
  describe('ALLOW_PROD_SEED', () => {
    it('defaults to false', () => {
      const env = baseEnv();
      delete env.ALLOW_PROD_SEED;
      const result = validateEnv(env);
      expect(result.ALLOW_PROD_SEED).toBe(false);
    });

    it('rejects true in production', () => {
      const env = { ...baseEnv(), ALLOW_PROD_SEED: 'true' };
      expect(() => validateEnv(env)).toThrow(/ALLOW_PROD_SEED must not be true in production/);
    });

    it('accepts true in development', () => {
      const env = { ...baseEnv(), NODE_ENV: 'development', ALLOW_PROD_SEED: 'true' };
      const result = validateEnv(env);
      expect(result.ALLOW_PROD_SEED).toBe(true);
    });
  });

  describe('PASSWORD_HISTORY_SIZE', () => {
    it('defaults to 5', () => {
      const env = baseEnv();
      delete env.PASSWORD_HISTORY_SIZE;
      expect(validateEnv(env).PASSWORD_HISTORY_SIZE).toBe(5);
    });

    it('accepts a positive integer override', () => {
      const env = { ...baseEnv(), PASSWORD_HISTORY_SIZE: '12' };
      expect(validateEnv(env).PASSWORD_HISTORY_SIZE).toBe(12);
    });

    it('rejects zero', () => {
      const env = { ...baseEnv(), PASSWORD_HISTORY_SIZE: '0' };
      expect(() => validateEnv(env)).toThrow(/PASSWORD_HISTORY_SIZE must be a positive integer/);
    });
  });

  describe('AUTH_AUDIT_RETENTION_DAYS', () => {
    it('defaults to 365', () => {
      const env = baseEnv();
      delete env.AUTH_AUDIT_RETENTION_DAYS;
      expect(validateEnv(env).AUTH_AUDIT_RETENTION_DAYS).toBe(365);
    });
  });

  describe('AUTH_OUTBOX_MAX_RETRIES', () => {
    it('defaults to 8', () => {
      const env = baseEnv();
      delete env.AUTH_OUTBOX_MAX_RETRIES;
      expect(validateEnv(env).AUTH_OUTBOX_MAX_RETRIES).toBe(8);
    });
  });

  describe('AUTH_OUTBOX_BASE_DELAY_SECONDS', () => {
    it('defaults to 30', () => {
      const env = baseEnv();
      delete env.AUTH_OUTBOX_BASE_DELAY_SECONDS;
      expect(validateEnv(env).AUTH_OUTBOX_BASE_DELAY_SECONDS).toBe(30);
    });
  });

  describe('AUTH_SESSION_INVALIDATION_CHANNEL', () => {
    it('defaults to auth:session:invalidate', () => {
      const env = baseEnv();
      delete env.AUTH_SESSION_INVALIDATION_CHANNEL;
      expect(validateEnv(env).AUTH_SESSION_INVALIDATION_CHANNEL).toBe('auth:session:invalidate');
    });

    it('accepts a custom channel', () => {
      const env = { ...baseEnv(), AUTH_SESSION_INVALIDATION_CHANNEL: 'custom:channel' };
      expect(validateEnv(env).AUTH_SESSION_INVALIDATION_CHANNEL).toBe('custom:channel');
    });
  });

  describe('GOOGLE_CLIENT_ID', () => {
    it('rejects empty value in production', () => {
      const env = baseEnv();
      delete env.GOOGLE_CLIENT_ID;
      expect(() => validateEnv(env)).toThrow(/GOOGLE_CLIENT_ID must be set in production/);
    });

    it('accepts an empty value in development', () => {
      const env: Record<string, unknown> = { ...baseEnv(), NODE_ENV: 'development' };
      delete env.GOOGLE_CLIENT_ID;
      expect(validateEnv(env).GOOGLE_CLIENT_ID).toBe('');
    });
  });

  describe('GOOGLE_HOSTED_DOMAIN', () => {
    it('defaults to empty string', () => {
      const env = baseEnv();
      delete env.GOOGLE_HOSTED_DOMAIN;
      expect(validateEnv(env).GOOGLE_HOSTED_DOMAIN).toBe('');
    });
  });

  describe('COIN_ADMIN_DAILY_CAP_PER_ADMIN', () => {
    it('defaults to 10_000_000', () => {
      const env = baseEnv();
      delete env.COIN_ADMIN_DAILY_CAP_PER_ADMIN;
      expect(validateEnv(env).COIN_ADMIN_DAILY_CAP_PER_ADMIN).toBe(10_000_000);
    });

    it('accepts a positive integer override', () => {
      const env = { ...baseEnv(), COIN_ADMIN_DAILY_CAP_PER_ADMIN: '5000000' };
      expect(validateEnv(env).COIN_ADMIN_DAILY_CAP_PER_ADMIN).toBe(5_000_000);
    });
  });

  describe('DISABLE_REDIS_SOCKET_ADAPTER', () => {
    it('defaults to false', () => {
      const env = baseEnv();
      delete env.DISABLE_REDIS_SOCKET_ADAPTER;
      expect(validateEnv(env).DISABLE_REDIS_SOCKET_ADAPTER).toBe(false);
    });

    it('accepts true', () => {
      const env = { ...baseEnv(), DISABLE_REDIS_SOCKET_ADAPTER: 'true' };
      expect(validateEnv(env).DISABLE_REDIS_SOCKET_ADAPTER).toBe(true);
    });
  });

  describe('SWAGGER_ENABLED', () => {
    it('defaults to false', () => {
      const env = baseEnv();
      delete env.SWAGGER_ENABLED;
      expect(validateEnv(env).SWAGGER_ENABLED).toBe(false);
    });

    it('accepts true', () => {
      const env = { ...baseEnv(), SWAGGER_ENABLED: 'true' };
      expect(validateEnv(env).SWAGGER_ENABLED).toBe(true);
    });
  });

  describe('TOURNAMENT_QUEUE_CONCURRENCY', () => {
    it('defaults to 5', () => {
      const env = baseEnv();
      delete env.TOURNAMENT_QUEUE_CONCURRENCY;
      expect(validateEnv(env).TOURNAMENT_QUEUE_CONCURRENCY).toBe(5);
    });

    it('accepts a positive integer override', () => {
      const env = { ...baseEnv(), TOURNAMENT_QUEUE_CONCURRENCY: '20' };
      expect(validateEnv(env).TOURNAMENT_QUEUE_CONCURRENCY).toBe(20);
    });
  });

  describe('RETRY_QUEUE_DLQ_*', () => {
    it('defaults attempt DLQ key', () => {
      const env = baseEnv();
      delete env.RETRY_QUEUE_DLQ_ATTEMPT_KEY;
      expect(validateEnv(env).RETRY_QUEUE_DLQ_ATTEMPT_KEY).toBe('tier:attempt:dlq');
    });

    it('defaults coin DLQ key', () => {
      const env = baseEnv();
      delete env.RETRY_QUEUE_DLQ_COIN_KEY;
      expect(validateEnv(env).RETRY_QUEUE_DLQ_COIN_KEY).toBe('tier:coin:dlq');
    });

    it('defaults comment DLQ key', () => {
      const env = baseEnv();
      delete env.RETRY_QUEUE_DLQ_COMMENT_KEY;
      expect(validateEnv(env).RETRY_QUEUE_DLQ_COMMENT_KEY).toBe('tier:comment:dlq');
    });

    it('accepts custom DLQ keys', () => {
      const env = {
        ...baseEnv(),
        RETRY_QUEUE_DLQ_ATTEMPT_KEY: 'custom:attempt',
        RETRY_QUEUE_DLQ_COIN_KEY: 'custom:coin',
        RETRY_QUEUE_DLQ_COMMENT_KEY: 'custom:comment',
      };
      const result = validateEnv(env);
      expect(result.RETRY_QUEUE_DLQ_ATTEMPT_KEY).toBe('custom:attempt');
      expect(result.RETRY_QUEUE_DLQ_COIN_KEY).toBe('custom:coin');
      expect(result.RETRY_QUEUE_DLQ_COMMENT_KEY).toBe('custom:comment');
    });
  });
});
