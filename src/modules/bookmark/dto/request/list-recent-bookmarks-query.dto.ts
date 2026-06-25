import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListRecentBookmarksQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    type: String,
    nullable: true,
    example: 'eyJib29rbWFya2VkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwWiIsImJvb2ttYXJrSWQiOiJ1dWlkIn0=',
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
