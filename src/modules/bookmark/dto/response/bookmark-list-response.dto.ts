import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookmarkedQuizResponseDto {
  @ApiProperty({
    description: 'Bookmark record identifier',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  bookmarkId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-71d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  quizImageUrl!: string | null;

  @ApiProperty({ description: 'Whether the quiz is featured', example: true })
  quizIsFeatured!: boolean;

  @ApiPropertyOptional({ description: 'Personal notes', type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

export class BookmarkListResponseDto {
  @ApiProperty({
    description: 'Bookmarked quizzes in the collection',
    type: [BookmarkedQuizResponseDto],
  })
  items!: BookmarkedQuizResponseDto[];
}
