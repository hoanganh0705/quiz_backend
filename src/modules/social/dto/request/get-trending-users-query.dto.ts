import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetTrendingUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of trending users',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Opaque cursor from a previous response. Omit to fetch the first page. ' +
      'Cursor is stable across trending-score recomputations within the same window.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
