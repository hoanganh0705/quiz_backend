import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  REPORT_REASON_VALUES,
  type ReviewReportReason,
} from '../../domain/policies/review-report-status.policy';

export class ReportReviewDto {
  @ApiProperty({
    description:
      'Structured reason tag for the report. The closed set lets the moderation dashboard ' +
      'group reports reliably. Use `details` for free-form context.',
    enum: REPORT_REASON_VALUES,
    example: 'spam',
  })
  @IsIn(REPORT_REASON_VALUES)
  reason!: ReviewReportReason;

  @ApiPropertyOptional({
    description: 'Additional moderation details (free text).',
    type: String,
    nullable: true,
    example: 'Contains advertising links',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string | null;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate reports on retry.',
    type: String,
    nullable: true,
    example: 'report-review-550e8400-e29b-71d4-a716-446655440099-charlie',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
