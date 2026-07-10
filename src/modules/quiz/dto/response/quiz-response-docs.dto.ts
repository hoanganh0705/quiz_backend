import { ApiProperty } from '@nestjs/swagger';

// ─── Quiz module documentation-only wrapper DTOs ─────────────────────────────
//
// Only one wrapper remains: `WrappedQuizListDto`. It is consumed by the
// category and tag swagger-decorator modules which document endpoints that
// embed lists of quizzes (e.g. "GET /categories/:slug/quizzes"). Once those
// modules migrate to the `ApiOkResourceList(QuizResponseDto, 'cursor')`
// decorator from `@/common/swagger/api-ok`, this class can also be deleted.
//
// All quiz-module-internal `Wrapped*Dto` classes were removed when the
// quiz controller migrated to the canonical `ApiOkResource*` decorators
// during the Phase 2 envelope migration.
//

class QuizDataDto {
  @ApiProperty({
    description: 'Unique quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  title!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript-fundamentals',
  })
  slug!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({
    description: 'Number of items returned in this page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Whether more items exist after this page',
    example: true,
  })
  hasNextPage!: boolean;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Cursor-based pagination metadata',
    type: () => PaginationMetaDataDto,
  })
  pagination!: PaginationMetaDataDto;
}

export class WrappedQuizListDto {
  @ApiProperty({
    description: 'Paginated quiz items',
    type: () => [QuizDataDto],
  })
  data!: QuizDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: () => PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}
