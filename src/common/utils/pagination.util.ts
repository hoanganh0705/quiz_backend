/**
 * Shared cursor-based pagination utilities.
 *
 * ## Usage
 *
 * Use `applyCursorPagination` in repositories to build paginated results from
 * `limit + 1` fetches. Each caller provides a cursor serializer that extracts
 * the ordering-key fields from the last row.
 *
 * @example
 * // Quiz pagination (ordered by createdAt DESC, quizId DESC)
 * const result = applyCursorPagination(rows, limit, (row) => ({
 *   createdAt: row.createdAt,
 *   quizId: row.quizId,
 * }));
 *
 * @example
 * // Version pagination (ordered by createdAt DESC, quizVersionId DESC)
 * const result = applyCursorPagination(rows, limit, (row) => ({
 *   createdAt: row.createdAt,
 *   quizVersionId: row.quizVersionId,
 * }));
 */

/**
 * Result shape returned by `applyCursorPagination`.
 */
export interface CursorPaginationResult<T, C = Record<string, string>> {
  items: readonly T[];
  limit: number;
  hasNextPage: boolean;
  nextCursor: C | null;
}

/**
 * Cursor serializer — extracts the ordering-key fields from a row.
 * The returned object's keys must match the SQL ORDER BY columns.
 */
export type CursorSerializer<T> = (row: T) => Record<string, string>;

/**
 * Apply cursor-based pagination to a row array fetched with `limit + 1`.
 *
 * @param rows       The fetched rows (may contain one extra row beyond `limit`)
 * @param limit     The page size requested by the caller
 * @param serialize Extracts cursor fields from the last item
 * @returns Paginated result with `items`, `limit`, `hasNextPage`, and `nextCursor`
 */
export function applyCursorPagination<T, C extends Record<string, string>>(
  rows: T[],
  limit: number,
  serialize: (row: T) => C,
): CursorPaginationResult<T, C> {
  const hasNextPage = rows.length > limit;
  const items: readonly T[] = hasNextPage ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    limit,
    hasNextPage,
    nextCursor: hasNextPage && lastItem ? serialize(lastItem) : null,
  };
}
