/**
 * PostgreSQL error codes for unique constraint violations.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

export function isPostgresUniqueViolation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === POSTGRES_UNIQUE_VIOLATION_CODE;
  }
  return false;
}
