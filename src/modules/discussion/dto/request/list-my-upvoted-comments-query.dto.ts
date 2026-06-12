import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMyUpvotedCommentsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    example:
      'eyJ1cHVvdGVkQXQiOiIyMDI2LTA2LTA4VDA5OjAwOjAwWiIsImNvbW1lbnRJZCI6Ijg4MGU4NDgwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
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
