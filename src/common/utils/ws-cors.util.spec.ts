import { resolveWsCorsOrigins } from './ws-cors.util';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_CORS_ORIGINS = process.env.CORS_ORIGINS;

const restoreEnv = (): void => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_CORS_ORIGINS === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = ORIGINAL_CORS_ORIGINS;
};

describe('resolveWsCorsOrigins', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('returns a single origin when CORS_ORIGINS is one entry', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    expect(resolveWsCorsOrigins()).toEqual(['https://app.example.com']);
  });

  it('splits and trims a comma-separated list', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '  https://a.example.com , https://b.example.com  ';
    expect(resolveWsCorsOrigins()).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('drops empty entries created by trailing commas', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://a.example.com,,https://b.example.com,';
    expect(resolveWsCorsOrigins()).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('throws when CORS_ORIGINS is unset in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    expect(() => resolveWsCorsOrigins()).toThrow(/CORS_ORIGINS/);
  });

  it('throws when CORS_ORIGINS is the empty string in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '';
    expect(() => resolveWsCorsOrigins()).toThrow(/CORS_ORIGINS/);
  });

  it('throws when CORS_ORIGINS is only commas/whitespace in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '   ,  , ,';
    expect(() => resolveWsCorsOrigins()).toThrow(/CORS_ORIGINS/);
  });

  it('falls back to the wildcard in development when CORS_ORIGINS is unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGINS;
    expect(resolveWsCorsOrigins()).toBe('*');
  });

  it('falls back to the wildcard in test when CORS_ORIGINS is unset', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGINS;
    expect(resolveWsCorsOrigins()).toBe('*');
  });

  it('falls back to the wildcard when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV;
    delete process.env.CORS_ORIGINS;
    expect(resolveWsCorsOrigins()).toBe('*');
  });
});
