import type { PaginationMeta } from './pagination';
import { normalizeTemporalFields } from '@/common/utils/temporal-normalizer.util';

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
      data: normalizeTemporalFields(data) as T,
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
      data: normalizeTemporalFields([...items]) as T[],
      meta: { timestamp: new Date().toISOString(), pagination },
    };
  }
}

/**
 * Type guard for the canonical response envelope. Returns `true` for any
 * plain object that has the canonical `{ data, meta: { timestamp } }`
 * shape (with optional `meta.pagination`).
 *
 * Used by `ResponseFormatInterceptor` (post-Phase-4) to detect envelopes
 * that were already produced by a presenter and pass them through
 * unchanged. Anything that does not match this shape is wrapped as `data`
 * with a `Logger.warn` so accidental drift becomes observable without
 * becoming a runtime crisis.
 *
 * Plain-object check: presenter's `ApiResponse.ok` / `ApiResponse.page`
 * factories emit plain objects (not class instances), so the prototype
 * is `Object.prototype` or `null`. Class instances would NOT pass this
 * check.
 */
export function isApiResponse<T = unknown>(value: unknown): value is ApiResponseEnvelope<T> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const dataKey = candidate.data;
  const metaKey = candidate.meta;

  if (!('data' in candidate) || !('meta' in candidate)) {
    return false;
  }

  if (dataKey === undefined) {
    return false;
  }

  if (metaKey === null || typeof metaKey !== 'object' || Array.isArray(metaKey)) {
    return false;
  }

  const meta = metaKey as Record<string, unknown>;
  if (typeof meta.timestamp !== 'string') {
    return false;
  }

  if ('pagination' in meta && meta.pagination !== undefined) {
    if (
      meta.pagination === null ||
      typeof meta.pagination !== 'object' ||
      Array.isArray(meta.pagination)
    ) {
      return false;
    }
  }

  return true;
}
