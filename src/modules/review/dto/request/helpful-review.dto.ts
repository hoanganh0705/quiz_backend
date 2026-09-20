import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  IDEMPOTENCY_KEY_PATTERN,
} from '../../domain/policies/review-report-status.policy';

export class HelpfulReviewDto {
  @ApiProperty({
    description: 'Whether the review should be marked as helpful',
    example: true,
  })
  @IsBoolean()
  helpful!: boolean;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate helpful votes on retry.',
    type: String,
    nullable: true,
    example: 'helpful-review-550e8400-e29b-71d4-a716-446655440099-bob',
  })
  @IsOptional()
  @IsString()
  @MaxLength(IDEMPOTENCY_KEY_MAX_LENGTH)
  @Matches(IDEMPOTENCY_KEY_PATTERN)
  idempotencyKey?: string;
}
