import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REPORT_REASON_VALUES } from '../../domain/policies/review-report-status.policy';

export class ReportedReviewItemDto {
  @ApiProperty({
    description: 'Unique report identifier',
    example: '990e8400-e29b-71d4-a716-446655440001',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reported review identifier',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  reviewId!: string;

  // Phase 4 / Issue #35 — the four fields below are nullable
  // because the underlying review row may have been hard-deleted
  // (the FK is `ON DELETE CASCADE`). The report itself still
  // exists and the user needs to see it, but the joined context
  // fields are gone. A `null` here is the contract signal that the
  // review no longer exists; clients should render a
  // "[deleted review]" placeholder rather than treat the absence
  // as data corruption.

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
    nullable: true,
  })
  quizId!: string | null;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
    nullable: true,
  })
  quizTitle!: string | null;

  @ApiProperty({
    description: 'Username of the review author',
    example: 'bob_builder',
    nullable: true,
  })
  reviewerUsername!: string | null;

  @ApiProperty({
    description: 'Star rating of the reported review (1–5)',
    example: 1,
    nullable: true,
  })
  rating!: number | null;

  @ApiPropertyOptional({
    description: 'Comment of the reported review',
    type: String,
    nullable: true,
  })
  comment!: string | null;

  @ApiProperty({
    description: 'Reason for reporting the review (closed set)',
    example: 'spam',
    enum: REPORT_REASON_VALUES,
  })
  reason!: import('@/modules/review/domain/policies/review-report-status.policy').ReviewReportReason;

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
