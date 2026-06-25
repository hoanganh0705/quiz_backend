import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkCollectionResponseDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({
    description: 'Owner user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ description: 'Number of bookmarked quizzes in this collection', example: 5 })
  quizCount!: number;

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
}

export class BookmarkCollectionListResponseDto {
  @ApiProperty({
    description: 'Collections owned by the authenticated user',
    type: () => [BookmarkCollectionResponseDto],
  })
  items!: BookmarkCollectionResponseDto[];
}
