import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListPlatformReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor for pagination',
    nullable: true,
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

  @ApiPropertyOptional({
    description: 'Filter by report status',
    enum: ['open', 'reviewed', 'dismissed', 'actioned'],
    example: 'open',
  })
  @IsOptional()
  @IsEnum(['open', 'reviewed', 'dismissed', 'actioned'])
  status?: 'open' | 'reviewed' | 'dismissed' | 'actioned';
}

export class UpdateReportStatusDto {
  @ApiProperty({
    description: 'New status for the report',
    enum: ['reviewed', 'dismissed', 'actioned'],
    example: 'actioned',
  })
  @IsEnum(['reviewed', 'dismissed', 'actioned'])
  status!: 'reviewed' | 'dismissed' | 'actioned';
}
