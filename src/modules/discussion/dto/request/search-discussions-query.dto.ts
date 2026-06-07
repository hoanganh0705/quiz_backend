import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchDiscussionsQueryDto {
  @ApiPropertyOptional({
    description: 'Search term matched against discussion title and body',
    example: 'scoring',
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  q?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–50)',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'eyJzY29yZSI6IjIwMjYtMDYtMDFUMTA6MDA6MDAuMDAwWiIsInRocmVhZElkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwMCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
