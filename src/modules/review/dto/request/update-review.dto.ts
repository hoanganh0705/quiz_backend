import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  // NOTE: The domain service requires rating to be provided. This is a documented
  // requirement (Phase 2 H3 fix). Changed from @ApiPropertyOptional to @ApiProperty
  // to align OpenAPI documentation with the runtime validation (no @IsOptional() decorator).
  @ApiProperty({
    description: 'Updated rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'Updated review text',
    type: String,
    nullable: true,
    maxLength: 1000,
    example: 'Updated my review after retaking the quiz.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}
