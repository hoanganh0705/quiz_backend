import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const REPORT_STATUS_VALUES = ['open', 'reviewed', 'dismissed', 'actioned'] as const;
const REPORT_TARGET_TYPE_VALUES = ['thread', 'comment'] as const;

export class ReportResponseDto {
  @ApiProperty({
    description: 'Report identifier',
    example: '990e8400-e29b-71d4-a716-446655440000',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reporting user identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  reporterId!: string;

  @ApiProperty({
    description: 'Type of content being reported',
    enum: REPORT_TARGET_TYPE_VALUES,
    example: 'comment',
  })
  targetType!: (typeof REPORT_TARGET_TYPE_VALUES)[number];

  @ApiProperty({
    description: 'Identifier of the reported target',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  targetId!: string;

  @ApiProperty({ description: 'Short report reason', example: 'Harassment' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional additional moderator context',
    type: String,
    nullable: true,
    example: 'Contains repeated personal attacks.',
  })
  details!: string | null;

  @ApiProperty({
    description: 'Current moderation status',
    enum: REPORT_STATUS_VALUES,
    example: 'open',
  })
  status!: (typeof REPORT_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description: 'Moderator who reviewed the report',
    type: String,
    nullable: true,
    example: null,
  })
  reviewedByUserId!: string | null;

  @ApiPropertyOptional({
    description: 'When the report was reviewed',
    type: String,
    nullable: true,
    example: null,
  })
  reviewedAt!: string | null;

  @ApiProperty({
    description: 'Whether moderation action was taken on the content',
    example: false,
  })
  actionTaken!: boolean;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T12:10:00.000Z',
  })
  updatedAt!: string;
}
