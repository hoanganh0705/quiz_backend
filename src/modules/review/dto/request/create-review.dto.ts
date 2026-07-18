import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'Optional written review',
    type: String,
    nullable: true,
    maxLength: 1000,
    example: 'Great quiz! Some questions were tricky but fair.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;

  @ApiPropertyOptional({
    description:
      'Idempotency key to prevent duplicate review submissions on retry. ' +
      'If a review was already submitted with this key, the cached response is returned.',
    type: String,
    nullable: true,
    example: 'create-review-550e8400-e29b-71d4-a716-446655440000-alice',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
