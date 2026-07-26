import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const REPORT_STATUS_VALUES = ['open', 'reviewed', 'dismissed', 'actioned'] as const;

/**
 * Wire-shape projection of a comment report. Returned by
 * `GET /comments/reports` and `POST /comments/reports/:reportId/review`.
 */
export class ReportDto {
  @ApiProperty({
    description: 'Report identifier',
    example: '990e8400-e29b-71d4-a716-446655440000',
  })
  reportId!: string;

  @ApiProperty({
    description: 'User identifier of the reporter',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  reporterId!: string;

  @ApiProperty({
    description: 'Comment identifier this report is filed against',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({ description: 'Short reason code', example: 'spam' })
  reason!: string;

  @ApiProperty({
    description: 'Optional additional context',
    type: String,
    nullable: true,
    example: 'Repeated promotional links.',
  })
  details!: string | null;

  @ApiProperty({
    description: 'Report lifecycle status',
    enum: REPORT_STATUS_VALUES,
    example: 'open',
  })
  status!: (typeof REPORT_STATUS_VALUES)[number];

  @ApiProperty({
    description: 'Moderator who reviewed the report, if any',
    type: String,
    nullable: true,
    example: null,
  })
  reviewedByUserId!: string | null;

  @ApiProperty({
    description: 'Timestamp at which the report was reviewed',
    type: String,
    nullable: true,
    example: null,
  })
  reviewedAt!: string | null;

  @ApiProperty({
    description: 'Whether the moderator took a content action as part of the review',
    example: false,
  })
  actionTaken!: boolean;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:35:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T10:45:00.000Z',
  })
  updatedAt!: string;
}
