import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMyCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTAyVDEwOjMwOjAwLjAwMFoiLCJjb21tZW50SWQiOiI4ODBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ==',
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
}
