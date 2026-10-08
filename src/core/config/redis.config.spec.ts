import { redisConfig } from './redis.config';

type RedisConfigShape = ReturnType<typeof redisConfig>;

const runConfig = (): RedisConfigShape => redisConfig();

const setEnv = (overrides: Partial<Record<string, string>>): void => {
  const keys = [
    'NODE_ENV',
    'REDIS_URL',
    'REDIS_KEY_PREFIX',
    'REDIS_CIRCUIT_FAILURE_THRESHOLD',
    'REDIS_CIRCUIT_RESET_TIMEOUT_MS',
  ] as const;
  for (const k of keys) {
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
};

describe('redisConfig.keyPrefix', () => {
  afterEach(() => {
    setEnv({});
  });

  it('uses REDIS_KEY_PREFIX as-is when provided in production', () => {
    setEnv({
      NODE_ENV: 'production',
      REDIS_KEY_PREFIX: 'prod:',
      REDIS_URL: 'redis://localhost:6379',
    });
    const cfg = runConfig();
    expect(cfg.keyPrefix).toBe('prod:');
  });

  it('throws when REDIS_KEY_PREFIX is empty in production', () => {
    setEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://localhost:6379' });
    expect(() => runConfig()).toThrow(/REDIS_KEY_PREFIX/);
  });

  it('falls back to "dev:" in development', () => {
    setEnv({ NODE_ENV: 'development', REDIS_URL: 'redis://localhost:6379' });
    const cfg = runConfig();
    expect(cfg.keyPrefix).toBe('dev:');
  });

  it('falls back to "test:" in test', () => {
    setEnv({ NODE_ENV: 'test', REDIS_URL: 'redis://localhost:6379' });
    const cfg = runConfig();
    expect(cfg.keyPrefix).toBe('test:');
  });

  it('rejects a whitespace-prefixed value in development', () => {
    setEnv({
      NODE_ENV: 'development',
      REDIS_KEY_PREFIX: 'a b',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(() => runConfig()).toThrow(/REDIS_KEY_PREFIX/);
  });
});
