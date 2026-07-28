import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared offset pagination query DTO.
 *
 * All modules should use this DTO for paginated endpoints to ensure
 * consistent API behavior across the backend.
 *
 * Default limit is 20, which is consistent with most other modules
 * in the codebase (category, quiz, review, tag, notification, etc.).
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of items to skip for offset-based pagination',
    type: Number,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
