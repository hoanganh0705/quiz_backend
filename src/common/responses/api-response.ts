import type { PaginationMeta } from './pagination';

/**
 * Wire-shape envelope returned by every successful HTTP endpoint.
 *
 * ```json
 * { "data": <payload>, "meta": { "timestamp": "<ISO 8601>", "pagination"?: <meta> } }
 * ```
 *
 * Type `T` is the application-layer DTO (e.g. `UserResponseDto`).
 * For paginated lists, `T` is `ItemDto[]` and `meta.pagination` is populated.
 */
export interface ApiResponseEnvelope<T> {
  data: T;
  meta: {
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Constructors for the canonical response envelope. Use these from
 * `transport/presenters/<module>.presenter.ts` to wrap application-service
 * output. The interceptor accepts these produced envelopes as a pass-through.
 *
 * The factory outputs are *plain objects* (not class instances) so they
 * pass the interceptor's `isFormattedResponse()` plain-object check.
 */
export class ApiResponse {
  /**
   * Wrap a single-resource payload.
   *
   * @example
   *   return ApiResponse.ok({ message: 'Account deleted successfully' });
   *
   * @example
   *   // Handlers with no body (Promise<void> at the application layer):
   *   return ApiResponse.ok(null);
   */
  static ok<T>(data: T): ApiResponseEnvelope<T> {
    return {
      data,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  /**
   * Wrap a paginated list. The second argument is a discriminated union:
   * pass either `CursorPagination` or `OffsetPagination` (see `pagination.ts`).
   *
   * @example
   *   return ApiResponse.page(quizzes, { kind: 'cursor', limit: 20, hasNextPage: true, nextCursor: 'eyJpZ...' });
   *
   * @example
   *   return ApiResponse.page(rows, { kind: 'offset', page: 1, limit: 20, total: 1342, hasMore: true });
   */
  static page<T>(items: readonly T[], pagination: PaginationMeta): ApiResponseEnvelope<T[]> {
    return {
      data: [...items],
      meta: { timestamp: new Date().toISOString(), pagination },
    };
  }
}
