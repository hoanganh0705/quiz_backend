import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchBookmarksQueryDto {
  @ApiProperty({
    description: 'Search term matched against quiz title and slug',
    example: 'react',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
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
