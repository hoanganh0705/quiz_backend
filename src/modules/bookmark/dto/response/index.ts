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

export class BulkAddBookmarksResponseDto {
  @ApiProperty({
    description: 'Number of bookmarks newly added to the collection',
    example: 2,
  })
  addedCount!: number;
}

export class BulkRemoveBookmarksResponseDto {
  @ApiProperty({
    description: 'Number of bookmarks removed from the collection',
    example: 2,
  })
  removedCount!: number;
}

export class BookmarkStatusCollectionDto {
  @ApiProperty({
    description: 'Collection identifier containing the bookmarked quiz',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Favorites' })
  name!: string;
}

export class BookmarkStatusResponseDto {
  @ApiProperty({
    description: 'Whether the authenticated user has bookmarked the quiz in any collection',
    example: true,
  })
  bookmarked!: boolean;

  @ApiProperty({
    description: 'Collections owned by the authenticated user that contain the quiz',
    type: () => [BookmarkStatusCollectionDto],
    example: [
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440000',
        name: 'Favorites',
      },
      {
        collectionId: '770e8400-e29b-41d4-a716-446655440001',
        name: 'React Learning',
      },
    ],
  })
  collections!: BookmarkStatusCollectionDto[];
}

export class RemoveBookmarkResponseDto {
  @ApiProperty({ description: 'Removal confirmation', example: 'Bookmark removed successfully' })
  message!: string;
}

export class MoveBookmarkResponseDto {
  @ApiProperty({ description: 'Move confirmation', example: 'Bookmark moved successfully' })
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

// ─── GET /bookmarks/me/stats ────────────────────────────────────────────────

export class BookmarkStatsFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Category URL slug', example: 'science' })
  slug!: string;
}

export class BookmarkStatsFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;

  @ApiProperty({ description: 'Tag URL slug', example: 'physics' })
  slug!: string;
}

export class BookmarkStatsResponseDto {
  @ApiProperty({
    description: 'Total number of bookmark collections owned by the user',
    example: 3,
  })
  totalCollections!: number;

  @ApiProperty({
    description: 'Total number of bookmarked quizzes across all collections',
    example: 27,
  })
  totalBookmarks!: number;

  @ApiPropertyOptional({
    description: 'Category with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: () => BookmarkStatsFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: BookmarkStatsFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Tag with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: () => BookmarkStatsFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: BookmarkStatsFavoriteTagDto | null;
}

// ─── GET /bookmarks/recent ──────────────────────────────────────────────────

export class RecentBookmarkItemDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Quiz cover image URL', format: 'uri', nullable: true })
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

  @ApiPropertyOptional({ description: 'Opaque cursor for the next page', nullable: true })
  nextCursor!: string | null;
}

export class RecentBookmarksResponseDto {
  @ApiProperty({ type: [RecentBookmarkItemDto] })
  items!: RecentBookmarkItemDto[];

  @ApiProperty({ type: RecentBookmarksPaginationDto })
  pagination!: RecentBookmarksPaginationDto;
}

export class SearchBookmarkItemDto {
  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'React Hooks Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'react-hooks-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Quiz cover image URL', format: 'uri', nullable: true })
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
  @ApiProperty({ type: [SearchBookmarkItemDto] })
  items!: SearchBookmarkItemDto[];

  @ApiProperty({ type: RecentBookmarksPaginationDto })
  pagination!: RecentBookmarksPaginationDto;
}

// ─── GET /bookmarks/collections/:collectionId/analytics ─────────────────────

export class BookmarkCollectionAnalyticsSummaryDto {
  @ApiProperty({ example: 24 })
  totalBookmarks!: number;

  @ApiProperty({ example: 24 })
  totalQuizzes!: number;

  @ApiProperty({ example: 4.2 })
  averageQuizRating!: number;

  @ApiProperty({ example: 6 })
  uniqueCategories!: number;

  @ApiProperty({ example: 11 })
  uniqueTags!: number;
}

export class BookmarkCollectionAnalyticsTopCategoryDto {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Science' })
  name!: string;

  @ApiProperty({ example: 'science' })
  slug!: string;

  @ApiProperty({ example: 8 })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsTopTagDto {
  @ApiProperty({ format: 'uuid' })
  tagId!: string;

  @ApiProperty({ example: 'Physics' })
  name!: string;

  @ApiProperty({ example: 'physics' })
  slug!: string;

  @ApiProperty({ example: 5 })
  bookmarkCount!: number;
}

export class BookmarkCollectionAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({ type: BookmarkCollectionAnalyticsSummaryDto })
  summary!: BookmarkCollectionAnalyticsSummaryDto;

  @ApiProperty({ type: [BookmarkCollectionAnalyticsTopCategoryDto] })
  topCategories!: BookmarkCollectionAnalyticsTopCategoryDto[];

  @ApiProperty({ type: [BookmarkCollectionAnalyticsTopTagDto] })
  topTags!: BookmarkCollectionAnalyticsTopTagDto[];

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
