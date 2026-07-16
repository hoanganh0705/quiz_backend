import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMyReviewsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination. Pass the `nextCursor` from a previous response.',
    type: String,
    example:
      'eyJjcmVhdGVkQXQiOiAiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwgInJldmlld0lkIjogIjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–100)',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
