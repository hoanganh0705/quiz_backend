import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMyUpvotedThreadsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'eyJ1cHVvdGVkQXQiOiIyMDI2LTA2LTA4VDA5OjAwOjAwWiIsInRocmVhZElkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=',
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
