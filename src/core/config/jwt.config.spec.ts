import { jwtConfig } from './jwt.config';

type JwtConfigShape = ReturnType<typeof jwtConfig>;

describe('jwtConfig — fail-fast on empty secrets', () => {
  const baseEnv = (): Record<string, unknown> => ({
    JWT_ACCESS_TOKEN_SECRET: 'a'.repeat(64),
    JWT_REFRESH_TOKEN_SECRET: 'b'.repeat(64),
    JWT_ACCESS_TOKEN_ISSUER: 'quiz-backend',
    JWT_ACCESS_TOKEN_AUDIENCE: 'quiz-client',
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
  });

  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('returns the parsed config when both secrets are non-empty', () => {
    process.env = { ...originalEnv, ...baseEnv() };
    const cfg: JwtConfigShape = jwtConfig();
    expect(cfg.accessSecret).toBe('a'.repeat(64));
    expect(cfg.refreshSecret).toBe('b'.repeat(64));
  });

  it('throws when JWT_ACCESS_TOKEN_SECRET is unset', () => {
    const env: Record<string, unknown> = baseEnv();
    delete env.JWT_ACCESS_TOKEN_SECRET;
    process.env = { ...originalEnv, ...env };
    expect(() => jwtConfig()).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('throws when JWT_ACCESS_TOKEN_SECRET is the empty string', () => {
    const env: Record<string, unknown> = baseEnv();
    env.JWT_ACCESS_TOKEN_SECRET = '';
    process.env = { ...originalEnv, ...env };
    expect(() => jwtConfig()).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('throws when JWT_REFRESH_TOKEN_SECRET is unset', () => {
    const env: Record<string, unknown> = baseEnv();
    delete env.JWT_REFRESH_TOKEN_SECRET;
    process.env = { ...originalEnv, ...env };
    expect(() => jwtConfig()).toThrow(/JWT_REFRESH_TOKEN_SECRET/);
  });

  it('throws when JWT_REFRESH_TOKEN_SECRET is the empty string', () => {
    const env: Record<string, unknown> = baseEnv();
    env.JWT_REFRESH_TOKEN_SECRET = '';
    process.env = { ...originalEnv, ...env };
    expect(() => jwtConfig()).toThrow(/JWT_REFRESH_TOKEN_SECRET/);
  });

  it('throws when both secrets are empty strings', () => {
    const env: Record<string, unknown> = baseEnv();
    env.JWT_ACCESS_TOKEN_SECRET = '';
    env.JWT_REFRESH_TOKEN_SECRET = '';
    process.env = { ...originalEnv, ...env };
    expect(() => jwtConfig()).toThrow(/JWT_(ACCESS|REFRESH)_TOKEN_SECRET/);
  });

  it('does not require issuer/audience to be non-empty (only the secrets are gated)', () => {
    process.env = {
      ...originalEnv,
      ...baseEnv(),
      JWT_ACCESS_TOKEN_ISSUER: '',
      JWT_ACCESS_TOKEN_AUDIENCE: '',
    };
    const cfg: JwtConfigShape = jwtConfig();
    expect(cfg.issuer).toBe('');
    expect(cfg.audience).toBe('');
  });
});
