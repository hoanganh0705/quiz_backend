import { ApiProperty } from '@nestjs/swagger';

// ─── Bookmark module documentation-only wrapper DTOs ─────────────────────────────
//
// These classes were migrated away from in Phase 1. The only class remaining is
// BookmarkDomainErrorDto which is still used for 403 / 404 / 409 error response
// schemas produced by BookmarkDomainExceptionFilter. All Wrapped*Dto classes
// and nested data types have been deleted; the OpenAPI spec now uses the generic
// ApiOkResource / ApiCreatedResource decorators from src/common/swagger/api-ok.ts.
//
// See docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md §5.3.
//
// ─── Error response schema ─────────────────────────────────────────────────────

/**
 * Runtime shape of bookmark domain errors handled by BookmarkDomainExceptionFilter:
 *   { statusCode: number, message: string, error: string }
 */
export class BookmarkDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the bookmark domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable message produced by the bookmark domain exception filter',
    example: 'Bookmark collection not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the bookmark domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}
