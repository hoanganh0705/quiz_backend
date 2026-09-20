import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from '@/common/utils/text.util';
import { MAX_REPORT_DETAILS_LENGTH } from '../../domain/constants';
import {
  COMMENT_REPORT_REASON_VALUES,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  type CommentReportReason,
} from '../../domain/policies/comment-report.policy';

export class ReportCommentDto {
  @ApiProperty({
    description: 'Short reason for the report',
    enum: COMMENT_REPORT_REASON_VALUES,
    example: 'spam',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsIn(COMMENT_REPORT_REASON_VALUES, {
    message: 'reason must be one of the supported report categories',
  })
  reason!: CommentReportReason;

  @ApiPropertyOptional({
    description: 'Optional longer explanation',
    type: String,
    maxLength: MAX_REPORT_DETAILS_LENGTH,
    nullable: true,
    example: 'Repeated promotional links.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(MAX_REPORT_DETAILS_LENGTH)
  details?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional caller-supplied idempotency key. Repeat requests with the same key are deduplicated.',
    maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(IDEMPOTENCY_KEY_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  idempotencyKey?: string;
}
