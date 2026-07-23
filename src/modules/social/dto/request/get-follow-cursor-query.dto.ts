import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cursor-based query DTO for user followers/following.
 * Ordered by (followedAt DESC, followId DESC).
 */
export class GetFollowCursorQueryDto {
  @ApiPropertyOptional({
    description:
      'Pagination cursor (base64url-encoded JSON: { followedAt: string, followId: string })',
    example:
      'eyJmb2xsb3dlZEF0IjoiMjAyNi0wNi0wOVQxMDowMDowMC4wMDBaIiwiZm9sbG93SWQiOiI1NTBlODQwMC1lMjliLTcxZDQtYTcxNi00NDY2NTU0NDAwMDAwIn0=',
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
