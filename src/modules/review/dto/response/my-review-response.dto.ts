import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyReviewItemDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Reviewed quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Reviewed quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 5 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Written review content',
    type: String,
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Last update timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt!: string | null;
}

export class MyReviewsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items are available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;
}

export class MyReviewsResponseDto {
  @ApiProperty({
    description: 'Authenticated user review items',
    type: () => [MyReviewItemDto],
  })
  items!: MyReviewItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => MyReviewsPaginationDto,
  })
  pagination!: MyReviewsPaginationDto;
}
