/**
 * PostgreSQL error codes.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FK_VIOLATION_CODE = '23503';

/**
 * Maximum number of `.cause` links to walk before giving up. Defensive
 * bound so a pathological cycle cannot hang the request thread.
 */
const MAX_CAUSE_DEPTH = 10;

/**
 * Resolve a `code` and `constraint` pair from an error that may or may
 * not be wrapped by Drizzle (or any other wrapper that exposes the
 * original on `.cause`).
 *
 * Drizzle's `DrizzleQueryError` exposes the original `pg` error on
 * `error.cause`, so reading `error.code` at the top level always
 * returns `undefined`. This helper walks the `cause` chain looking for
 * the first object that carries a `code` string, which is the
 * convention used by `pg`, `postgres-js`, and Drizzle alike.
 *
 * Returns an empty object (rather than `null`) when no recognizable
 * error is found, so callers can use object destructuring without an
 * intermediate null check.
 */
export function resolvePgError(error: unknown): {
  code?: string;
  constraint?: string;
} {
  let cur: unknown = error;
  for (let i = 0; i < MAX_CAUSE_DEPTH && cur && typeof cur === 'object'; i += 1) {
    const node = cur as { code?: unknown; constraint?: unknown };
    const code = typeof node.code === 'string' ? node.code : undefined;
    const constraint = typeof node.constraint === 'string' ? node.constraint : undefined;
    if (code !== undefined) {
      return { code, constraint };
    }
    cur = (node as { cause?: unknown }).cause;
  }
  return {};
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return resolvePgError(error).code === POSTGRES_UNIQUE_VIOLATION_CODE;
}

export function isPostgresForeignKeyViolation(error: unknown): boolean {
  return resolvePgError(error).code === POSTGRES_FK_VIOLATION_CODE;
}
