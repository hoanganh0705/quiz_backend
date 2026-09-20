import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_PATTERN,
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
  @MaxLength(IDEMPOTENCY_KEY_MAX_LENGTH)
  @Matches(IDEMPOTENCY_KEY_PATTERN)
  idempotencyKey?: string;
}
