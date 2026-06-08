import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTrendingDiscussionsQueryDto {
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
      'eyJzY29yZSI6MTIzLjQ1LCJ0aHJlYWRJZCI6IjY2MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
