import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REPORT_REASON_VALUES } from '@/modules/review/domain/policies/review-report-status.policy';

export class PlatformReportItemDto {
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

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Username of the person who reported the review',
    example: 'bob_builder',
  })
  reviewerUsername!: string;

  @ApiProperty({
    description: 'User ID of the review author who was reported',
    example: '770e8400-e29b-71d4-a716-446655440001',
  })
  reportedUserId!: string;

  @ApiProperty({ description: 'Star rating of the reported review (1–5)', example: 1 })
  rating!: number;

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
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Last update timestamp (ISO 8601)',
    type: String,
    nullable: true,
  })
  updatedAt!: string | null;
}

export class PlatformReportsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
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

export class PlatformReportsResponseDto {
  @ApiProperty({
    description: 'Platform-wide reported review items for moderation',
    type: () => [PlatformReportItemDto],
  })
  items!: PlatformReportItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => PlatformReportsPaginationDto,
  })
  pagination!: PlatformReportsPaginationDto;
}

export class UpdateReportStatusResponseDto {
  @ApiProperty({
    description: 'Status update result',
    example: 'Report status updated successfully',
  })
  message!: string;
}
