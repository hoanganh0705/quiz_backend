import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecentBookmarkItemDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
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

  @ApiProperty({ description: 'Collection name', example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

export class RecentBookmarksPaginationDto {
  @ApiProperty({ description: 'Maximum number of items returned', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether there are more items after this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;
}

export class RecentBookmarksResponseDto {
  @ApiProperty({ type: [RecentBookmarkItemDto] })
  items!: RecentBookmarkItemDto[];

  @ApiProperty({ type: RecentBookmarksPaginationDto })
  pagination!: RecentBookmarksPaginationDto;
}
