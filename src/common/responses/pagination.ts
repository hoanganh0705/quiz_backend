import { ApiProperty } from '@nestjs/swagger';

/**
 * Cursor-based pagination metadata. Wire shape:
 *
 * ```json
 * { "kind": "cursor", "limit": 20, "hasNextPage": true, "nextCursor": "eyJpZ..." }
 * ```
 *
 * `nextCursor` is `null` (not omitted) when no further pages exist. Clients
 * that respect the `kind` discriminator can switch on this field to choose
 * the right pagination flow.
 */
export class CursorPagination {
  @ApiProperty({
    description: 'Discriminator field. Always "cursor" for cursor pagination.',
    example: 'cursor',
  })
  readonly kind!: 'cursor';

  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
  readonly limit!: number;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  readonly hasNextPage!: boolean;

  @ApiProperty({
    description:
      'Opaque cursor string for fetching the next page. `null` when there is no next page.',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxVDAwOjAwOjAwKzAwOjAwIiwiY3JlYXRpbmdVc2VySWQiOiI4MTIzMTIzLTEyMzQtMTIzNC0xMjM0LTEyMzQxMjM0MTIzNDQifQ',
    nullable: true,
  })
  readonly nextCursor!: string | null;
}

/**
 * Offset-based pagination metadata. Wire shape:
 *
 * ```json
 * { "kind": "offset", "page": 1, "limit": 20, "total": 1342, "hasMore": true }
 * ```
 */
export class OffsetPagination {
  @ApiProperty({
    description: 'Discriminator field. Always "offset" for offset pagination.',
    example: 'offset',
  })
  readonly kind!: 'offset';

  @ApiProperty({ description: '1-indexed page number that was just returned', example: 1 })
  readonly page!: number;

  @ApiProperty({ description: 'Maximum number of items per page', example: 20 })
  readonly limit!: number;

  @ApiProperty({ description: 'Total number of items matching the query', example: 1342 })
  readonly total!: number;

  @ApiProperty({ description: 'Whether more pages exist after the current one', example: true })
  readonly hasMore!: boolean;
}

/**
 * Discriminated union of all pagination shapes. Exactly one of `CursorPagination`
 * or `OffsetPagination` is valid at a time; the `kind` field is the runtime
 * discriminator.
 *
 * Use this on the presentation-layer envelope only. Application services should
 * carry `PaginatedResult<T>` (see `paginated-result.ts`).
 */
export type PaginationMeta = CursorPagination | OffsetPagination;

/**
 * Type predicate helper for narrowing `PaginationMeta`.
 */
export const isCursorPagination = (meta: PaginationMeta): meta is CursorPagination =>
  meta.kind === 'cursor';

/**
 * Type predicate helper for narrowing `PaginationMeta`.
 */
export const isOffsetPagination = (meta: PaginationMeta): meta is OffsetPagination =>
  meta.kind === 'offset';
