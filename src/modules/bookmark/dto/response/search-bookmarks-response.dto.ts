import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecentBookmarksPaginationDto } from './recent-bookmarks-response.dto';

export class SearchBookmarkItemDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'React Hooks Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'react-hooks-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Collection identifier', format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'React Learning' })
  collectionName!: string;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

export class SearchBookmarksResponseDto {
  @ApiProperty({
    description: 'Bookmarks matching the search query, ordered by relevance',
    type: [SearchBookmarkItemDto],
  })
  items!: SearchBookmarkItemDto[];

  @ApiProperty({ description: 'Cursor pagination metadata', type: RecentBookmarksPaginationDto })
  pagination!: RecentBookmarksPaginationDto;
}
