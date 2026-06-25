import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewResponseDto {
  @ApiProperty({
    description: 'Review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Updated star rating', example: 5 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Updated review text', type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}
