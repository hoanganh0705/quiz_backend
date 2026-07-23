import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cursor-based query DTO for social feed.
 * Feed is ordered by (occurredAt DESC, activityId DESC).
 */
export class GetFeedCursorQueryDto {
  @ApiPropertyOptional({
    description:
      'Pagination cursor (base64url-encoded JSON: { occurredAt: string, activityId: string })',
    example:
      'eyJvY2N1cnJlZEF0IjoiMjAyNi0wNi0wOVQxMDowMDowMC4wMDBaIiwiYWN0aXZpdHlJZCI6IjY2MGU4NDAwLWUyOWItNzFkNC1hNzE2LTQ0NjY1NTQ0MDAwMDAifQ==',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
