import { validateEnv } from './env.validation';

describe('validateEnv — email configuration', () => {
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

  describe('EMAIL_VERIFICATION_BASE_URL', () => {
    it('accepts a valid https URL', () => {
      const env = baseEnv();
      env.EMAIL_VERIFICATION_BASE_URL = 'https://quiz.example.com/verify-email';
      const result = validateEnv(env);
      expect(result.EMAIL_VERIFICATION_BASE_URL).toBe('https://quiz.example.com/verify-email');
    });

    it('returns an empty string when unset (handler falls back to localhost)', () => {
      const env = baseEnv();
      delete env.EMAIL_VERIFICATION_BASE_URL;
      const result = validateEnv(env);
      expect(result.EMAIL_VERIFICATION_BASE_URL).toBe('');
    });

    it('rejects a non-URL string', () => {
      const env = baseEnv();
      env.EMAIL_VERIFICATION_BASE_URL = 'not-a-url';
      expect(() => validateEnv(env)).toThrow(/EMAIL_VERIFICATION_BASE_URL/);
    });
  });

  describe('PASSWORD_RESET_BASE_URL', () => {
    it('accepts a valid http URL', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_BASE_URL = 'http://localhost:3000/reset-password';
      const result = validateEnv(env);
      expect(result.PASSWORD_RESET_BASE_URL).toBe('http://localhost:3000/reset-password');
    });

    it('falls back to the localhost default when unset', () => {
      const env = baseEnv();
      delete env.PASSWORD_RESET_BASE_URL;
      const result = validateEnv(env);
      expect(result.PASSWORD_RESET_BASE_URL).toBe('http://localhost:3000/reset-password');
    });

    it('rejects a malformed URL', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_BASE_URL = ':::::';
      expect(() => validateEnv(env)).toThrow(/PASSWORD_RESET_BASE_URL/);
    });
  });

  describe('PASSWORD_RESET_TOKEN_TTL_SECONDS', () => {
    it('accepts a positive integer', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_TOKEN_TTL_SECONDS = '7200';
      const result = validateEnv(env);
      expect(result.PASSWORD_RESET_TOKEN_TTL_SECONDS).toBe(7_200);
    });

    it('rejects zero', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_TOKEN_TTL_SECONDS = '0';
      expect(() => validateEnv(env)).toThrow(/PASSWORD_RESET_TOKEN_TTL_SECONDS/);
    });

    it('rejects a negative integer', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_TOKEN_TTL_SECONDS = '-1';
      expect(() => validateEnv(env)).toThrow(/PASSWORD_RESET_TOKEN_TTL_SECONDS/);
    });

    it('rejects a non-numeric string', () => {
      const env = baseEnv();
      env.PASSWORD_RESET_TOKEN_TTL_SECONDS = 'forever';
      expect(() => validateEnv(env)).toThrow(/PASSWORD_RESET_TOKEN_TTL_SECONDS/);
    });
  });

  describe('EMAIL_CB_FAILURE_THRESHOLD', () => {
    it('accepts a positive integer', () => {
      const env = baseEnv();
      env.EMAIL_CB_FAILURE_THRESHOLD = '7';
      const result = validateEnv(env);
      expect(result.EMAIL_CB_FAILURE_THRESHOLD).toBe(7);
    });

    it('rejects zero', () => {
      const env = baseEnv();
      env.EMAIL_CB_FAILURE_THRESHOLD = '0';
      expect(() => validateEnv(env)).toThrow(/EMAIL_CB_FAILURE_THRESHOLD/);
    });
  });

  describe('EMAIL_CB_RESET_TIMEOUT_MS', () => {
    it('accepts a positive integer', () => {
      const env = baseEnv();
      env.EMAIL_CB_RESET_TIMEOUT_MS = '60000';
      const result = validateEnv(env);
      expect(result.EMAIL_CB_RESET_TIMEOUT_MS).toBe(60_000);
    });

    it('rejects zero', () => {
      const env = baseEnv();
      env.EMAIL_CB_RESET_TIMEOUT_MS = '0';
      expect(() => validateEnv(env)).toThrow(/EMAIL_CB_RESET_TIMEOUT_MS/);
    });
  });
});
