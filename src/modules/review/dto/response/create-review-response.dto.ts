import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewResponseDto {
  @ApiProperty({
    description: 'New review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Star rating', example: 4 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Review text', type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}
