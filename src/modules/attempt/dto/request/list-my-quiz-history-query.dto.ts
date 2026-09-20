import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMyQuizHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    type: String,
    nullable: true,
    example:
      'eyJzb3J0VmFsdWUiOiIyMDI1LTA2LTAxVDEyOjQ1OjAwLjAwMFoiLCJhdHRlbXB0SWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of attempts to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter attempts by status',
    type: String,
    enum: ['started', 'completed', 'abandoned'],
    example: 'completed',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['started', 'completed', 'abandoned'])
  status?: 'started' | 'completed' | 'abandoned';

  @ApiPropertyOptional({
    description: 'Filter attempts created on or after this ISO 8601 timestamp',
    type: String,
    example: '2025-01-01T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter attempts created on or before this ISO 8601 timestamp',
    type: String,
    example: '2025-12-31T23:59:59.999Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  toDate?: string;
}
