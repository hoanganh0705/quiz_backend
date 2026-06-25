import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportedReviewItemDto {
  @ApiProperty({
    description: 'Unique report identifier',
    example: '990e8400-e29b-41d4-a716-446655440001',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reported review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Username of the review author', example: 'bob_builder' })
  reviewerUsername!: string;

  @ApiProperty({ description: 'Star rating of the reported review (1–5)', example: 1 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Content of the reported review',
    type: String,
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({ description: 'Reason for reporting the review', example: 'spam' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details',
    type: String,
    nullable: true,
  })
  details!: string | null;

  @ApiProperty({
    description: 'Current status of the report',
    example: 'open',
    enum: ['open', 'reviewed', 'dismissed', 'actioned'],
  })
  status!: 'open' | 'reviewed' | 'dismissed' | 'actioned';

  @ApiProperty({
    description: 'Timestamp when the report was created (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the report was last updated (ISO 8601)',
    type: String,
    nullable: true,
  })
  updatedAt!: string | null;
}

export class ReportedReviewsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items are available', example: false })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;
}

export class ReportedReviewsResponseDto {
  @ApiProperty({
    description: 'Reported review items submitted by the authenticated user',
    type: () => [ReportedReviewItemDto],
  })
  items!: ReportedReviewItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => ReportedReviewsPaginationDto,
  })
  pagination!: ReportedReviewsPaginationDto;
}
