import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from './enums';

export class ReviewReportDto {
  @ApiProperty({
    description: 'Resolution status of the report',
    enum: ReportStatus,
    example: 'actioned',
  })
  @IsEnum(ReportStatus)
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
