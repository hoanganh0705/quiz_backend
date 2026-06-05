import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListFollowedTagsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example: 'eyJmb2xsb3dlZEF0IjoiMjAyNi0wMS0wMVQwMDowMDowMFoiLCJmb2xsb3dJZCI6InV1aWQifQ==',
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
