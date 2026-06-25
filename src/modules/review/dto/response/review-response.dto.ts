import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Reviewer user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Reviewer username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Reviewer avatar URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  userAvatarUrl!: string | null;

  @ApiProperty({ description: 'Star rating (1–5)', example: 4 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Review text', type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Number of users who found this review helpful',
    example: 42,
  })
  helpfulCount!: number;
}

export class ReviewPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Cursor for next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: false })
  hasNextPage!: boolean;
}
