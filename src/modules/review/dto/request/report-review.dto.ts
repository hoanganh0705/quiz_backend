import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ReportReviewDto {
  @ApiProperty({
    description:
      'Reason for reporting the review. This is a free-form string field. ' +
      'Common values include: spam, harassment, inappropriate_content, other. ' +
      'Maximum length is 255 characters.',
    example: 'spam',
  })
  @IsString()
  @MaxLength(255)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details',
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
