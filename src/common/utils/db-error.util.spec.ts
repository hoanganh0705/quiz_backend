import {
  isPostgresForeignKeyViolation,
  isPostgresUniqueViolation,
  resolvePgError,
} from './db-error.util';

describe('db-error.util — Drizzle error-wrapping awareness', () => {
  describe('resolvePgError', () => {
    it('reads `code` from a raw pg error at the top level (back-compat)', () => {
      const err = { code: '23505', constraint: 'uq_x' };
      expect(resolvePgError(err)).toEqual({ code: '23505', constraint: 'uq_x' });
    });

    it('walks the `cause` chain to find the original pg error inside DrizzleQueryError', () => {
      const inner = { code: '23505', constraint: 'uq_bookmark_collections_user_name' };
      const drizzle = new Error('Failed query: insert into bookmark_collections ...');
      // Drizzle's DrizzleQueryError exposes the original error on `cause`.
      (drizzle as Error & { cause?: unknown }).cause = inner;

      expect(resolvePgError(drizzle)).toEqual({
        code: '23505',
        constraint: 'uq_bookmark_collections_user_name',
      });
    });

    it('walks multiple `cause` levels', () => {
      const inner = { code: '23503' };
      const middle = new Error('middle');
      (middle as Error & { cause?: unknown }).cause = inner;
      const outer = new Error('outer');
      (outer as Error & { cause?: unknown }).cause = middle;

      expect(resolvePgError(outer)).toEqual({ code: '23503', constraint: undefined });
    });

    it('returns an empty object when no recognizable code is found', () => {
      expect(resolvePgError(new Error('plain'))).toEqual({});
      expect(resolvePgError(null)).toEqual({});
      expect(resolvePgError(undefined)).toEqual({});
      expect(resolvePgError('a string')).toEqual({});
    });

    it('treats non-string `code` as not-found (does not match)', () => {
      // Some libraries put non-PG-string values in `code`. Defensive: skip them.
      const err = { code: 23505 as unknown as string };
      expect(resolvePgError(err)).toEqual({});
    });

    it('does not loop forever on cyclic causes', () => {
      const a: { cause?: unknown } = {};
      const b: { cause?: unknown } = {};
      a.cause = b;
      b.cause = a;
      expect(() => resolvePgError(a)).not.toThrow();
      expect(resolvePgError(a)).toEqual({});
    });
  });

  describe('isPostgresUniqueViolation', () => {
    it('returns true for a wrapped unique violation (Drizzle path)', () => {
      const inner = { code: '23505' };
      const drizzle = new Error('wrapper');
      (drizzle as Error & { cause?: unknown }).cause = inner;
      expect(isPostgresUniqueViolation(drizzle)).toBe(true);
    });

    it('returns true for a raw pg error (back-compat)', () => {
      expect(isPostgresUniqueViolation({ code: '23505' })).toBe(true);
    });

    it('returns false for a foreign key violation', () => {
      expect(isPostgresUniqueViolation({ code: '23503' })).toBe(false);
    });

    it('returns false for unknown errors', () => {
      expect(isPostgresUniqueViolation(new Error('oops'))).toBe(false);
    });
  });

  describe('isPostgresForeignKeyViolation', () => {
    it('returns true for a wrapped foreign key violation (Drizzle path)', () => {
      const inner = { code: '23503' };
      const drizzle = new Error('wrapper');
      (drizzle as Error & { cause?: unknown }).cause = inner;
      expect(isPostgresForeignKeyViolation(drizzle)).toBe(true);
    });

    it('returns true for a raw pg error (back-compat)', () => {
      expect(isPostgresForeignKeyViolation({ code: '23503' })).toBe(true);
    });

    it('returns false for a unique violation', () => {
      expect(isPostgresForeignKeyViolation({ code: '23505' })).toBe(false);
    });
  });
});
