import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  REPORT_REPORT_WRITABLE_STATUSES,
  REVIEW_REPORT_PLATFORM_STATUS_VALUES,
  type ReviewReportWritableStatus,
} from '../../domain/policies/review-report-status.policy';

export class ListPlatformReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination. Pass the `nextCursor` from a previous response.',
    type: String,
    example:
      'eyJjcmVhdGVkQXQiOiAiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwgInJlcG9ydElkIjogIjk5MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Filter by report status. Defaults to `open` so the moderation queue surfaces only unhandled reports; pass `all` to see every status.',
    enum: REVIEW_REPORT_PLATFORM_STATUS_VALUES,
    default: 'open',
  })
  @IsOptional()
  @IsIn(REVIEW_REPORT_PLATFORM_STATUS_VALUES)
  status?: (typeof REVIEW_REPORT_PLATFORM_STATUS_VALUES)[number];
}

export class UpdateReportStatusDto {
  @ApiProperty({
    description: 'New status for the report',
    enum: REPORT_REPORT_WRITABLE_STATUSES,
    example: 'actioned',
  })
  @IsEnum(REPORT_REPORT_WRITABLE_STATUSES)
  status!: ReviewReportWritableStatus;
}
