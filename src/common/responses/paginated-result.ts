import type { PaginationMeta } from './pagination';

/**
 * Domain-level concept of a paginated result. Application services return
 * this type from their query methods. It carries no HTTP-specific knowledge
 * (no `data` / `meta` envelope), so the same value can be reused by REST,
 * GraphQL, gRPC, CLI, batch, or test consumers.
 *
 * The presentation layer wraps this via `ApiResponse.page(items, pagination)`.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly pagination: PaginationMeta;
}

/**
 * Convenience constructor for `PaginatedResult<T>`.
 *
 * @example
 *   return paginated(rows, { kind: 'cursor', limit: 20, hasNextPage: false, nextCursor: null });
 */
export const paginated = <T>(
  items: readonly T[],
  pagination: PaginationMeta,
): PaginatedResult<T> => ({
  items,
  pagination,
});
