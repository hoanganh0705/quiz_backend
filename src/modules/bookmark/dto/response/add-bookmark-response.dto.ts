import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'Personal notes', type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}
