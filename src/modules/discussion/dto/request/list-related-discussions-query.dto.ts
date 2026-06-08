import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListRelatedDiscussionsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of related discussion threads to return (1–10)',
    minimum: 1,
    maximum: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 10;
}
