import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Cursor for cursor-based pagination',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of reports to return per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by report status',
    enum: ['open', 'reviewed', 'dismissed', 'actioned'],
    example: 'open',
    nullable: true,
  })
  @IsOptional()
  @IsIn(['open', 'reviewed', 'dismissed', 'actioned'])
  status?: 'open' | 'reviewed' | 'dismissed' | 'actioned';
}
