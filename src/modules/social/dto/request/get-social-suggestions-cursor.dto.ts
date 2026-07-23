import { Type } from 'class-transformer';
import { IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cursor-based query DTO for social suggestions.
 * Suggestions are ordered by (score DESC, mutualFriends DESC, mutualFollowers DESC, username ASC).
 */
export class GetSocialSuggestionsCursorDto {
  @ApiPropertyOptional({
    description: 'Pagination cursor (base64url-encoded JSON: { score: number, username: string })',
    example: 'eyJzY29yZSI6MTIwMDAsInVzZXJuYW1lIjoiYW5oX2RldiJ9',
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
