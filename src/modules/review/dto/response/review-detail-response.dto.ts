import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewDetailResponseDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Reviewed quiz identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Reviewed quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({
    description: 'Reviewer user identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Reviewer username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 5 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Written review comment',
    type: String,
    nullable: true,
  })
  comment!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Number of users who found this review helpful',
    example: 42,
  })
  helpfulCount!: number;
}
