import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { COMMENTS_DEFAULT_PAGE_LIMIT, COMMENTS_MAX_PAGE_LIMIT } from '../../domain/constants';
import { REPORT_STATUS, type ReportStatus } from '../../domain/types';

/**
 * Cursor-based query DTO for `GET /comments/reports`. Supports an
 * optional status filter.
 */
export class ListReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque pagination cursor returned by the previous page',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjM1OjAwLjAwMFoiLCJpZCI6Ijk5MGU4NDAwLWUyOWItNzFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of reports to return per page',
    example: COMMENTS_DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: COMMENTS_MAX_PAGE_LIMIT,
    default: COMMENTS_DEFAULT_PAGE_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMENTS_MAX_PAGE_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by report lifecycle status',
    enum: REPORT_STATUS,
    example: 'open',
  })
  @IsOptional()
  @IsIn(REPORT_STATUS)
  status?: ReportStatus;
}
