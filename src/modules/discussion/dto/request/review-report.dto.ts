import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewReportDto {
  @ApiProperty({
    description: 'Resolution status of the report',
    enum: ['reviewed', 'dismissed', 'actioned'],
    example: 'actioned',
  })
  @IsIn(['reviewed', 'dismissed', 'actioned'])
  status!: 'reviewed' | 'dismissed' | 'actioned';

  @ApiPropertyOptional({
    description: 'Whether moderation action was taken on the reported content',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  actionTaken?: boolean;
}
