import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REVIEW_REPORT_STATUS } from '../../domain/types';
import type { ReviewReportStatus } from '../../domain/types';

export class ReviewReportDto {
  @ApiProperty({
    description: 'Resolution status of the report',
    enum: REVIEW_REPORT_STATUS,
    example: 'actioned',
  })
  @IsIn(REVIEW_REPORT_STATUS)
  status!: ReviewReportStatus;

  @ApiPropertyOptional({
    description: 'Whether moderation action was taken on the reported content',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  actionTaken?: boolean;
}
