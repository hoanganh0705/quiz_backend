import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REVIEW_REPORT_STATUS, type ReviewReportStatus } from '../../domain/types';

export class ReviewReportDto {
  @ApiProperty({
    description: 'New status for the report',
    enum: REVIEW_REPORT_STATUS,
    example: 'actioned',
  })
  @IsIn(REVIEW_REPORT_STATUS)
  status!: ReviewReportStatus;

  @ApiPropertyOptional({
    description:
      'Whether the moderator took a content action (e.g. hid the comment) as part of the review. Informational only.',
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  actionTaken?: boolean;
}
