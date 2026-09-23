import { isNull, type SQL, type Column } from 'drizzle-orm';

/**
 * Returns an `isNull(column)` predicate suitable for filtering out
 * soft-deleted rows in repository queries.
 *
 * Usage:
 *   import { notDeleted } from '@/common/database/soft-delete.helper';
 *   .where(and(notDeleted(quizzes.deletedAt), eq(quizzes.quizId, id)))
 *
 * Works with any Drizzle `AnyPgColumn` / `AnyMySqlColumn`.
 */
export function notDeleted<T extends Column>(column: T): SQL {
  return isNull(column);
}
