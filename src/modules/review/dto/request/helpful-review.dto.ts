import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
    example: 'helpful-review-550e8400-e29b-41d4-a716-446655440099-bob',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
