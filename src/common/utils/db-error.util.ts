/**
 * PostgreSQL error codes.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const POSTGRES_FK_VIOLATION_CODE = '23503';

export function isPostgresUniqueViolation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === POSTGRES_UNIQUE_VIOLATION_CODE;
  }
  return false;
}

export function isPostgresForeignKeyViolation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === POSTGRES_FK_VIOLATION_CODE;
  }
  return false;
}
