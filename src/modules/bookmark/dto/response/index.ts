import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkedQuizResponseDto {
  @ApiProperty({
    description: 'Bookmark record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  bookmarkId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiPropertyOptional({ description: 'Quiz cover image URL', format: 'uri', nullable: true })
  quizImageUrl!: string | null;

  @ApiProperty({ description: 'Whether the quiz is featured', example: true })
  quizIsFeatured!: boolean;

  @ApiPropertyOptional({ description: 'Quiz difficulty', nullable: true })
  quizDifficulty!: string | null;

  @ApiPropertyOptional({ description: 'Personal notes', nullable: true })
  notes!: string | null;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

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

  @ApiPropertyOptional({ description: 'Collection description', nullable: true })
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

export class BookmarkListResponseDto {
  @ApiProperty({
    description: 'Bookmarked quizzes in the collection',
    type: () => [BookmarkedQuizResponseDto],
  })
  items!: BookmarkedQuizResponseDto[];
}

export class CreateCollectionResponseDto {
  @ApiProperty({
    description: 'New collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

export class AddBookmarkResponseDto {
  @ApiProperty({
    description: 'Bookmark record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  bookmarkId!: string;

  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiPropertyOptional({ description: 'Personal notes', nullable: true })
  notes!: string | null;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

export class RemoveBookmarkResponseDto {
  @ApiProperty({ description: 'Removal confirmation', example: 'Bookmark removed successfully' })
  message!: string;
}

export class UpdateCollectionResponseDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', nullable: true })
  description!: string | null;

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

export class DeleteCollectionResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Collection deleted successfully' })
  message!: string;
}
