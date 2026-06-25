import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Bookmark module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// Runtime DTO classes (BookmarkCollectionResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class BookmarkStatusCollectionDataDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Favorites' })
  name!: string;
}

class BookmarkStatusDataDto {
  @ApiProperty({
    description: 'Whether the authenticated user has bookmarked the quiz',
    example: true,
  })
  bookmarked!: boolean;

  @ApiProperty({
    description: 'Collections owned by the authenticated user that contain the quiz',
    type: [BookmarkStatusCollectionDataDto],
  })
  collections!: BookmarkStatusCollectionDataDto[];
}

class BookmarkCollectionDataDto {
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

class BookmarkedQuizDataDto {
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

class AddBookmarkDataDto {
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

class UpdateBookmarkDataDto {
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

  @ApiPropertyOptional({ description: 'Updated personal notes', type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}

class BulkAddDataDto {
  @ApiProperty({ description: 'Number of bookmarks newly added to the collection', example: 2 })
  addedCount!: number;
}

class BulkRemoveDataDto {
  @ApiProperty({ description: 'Number of bookmarks removed from the collection', example: 2 })
  removedCount!: number;
}

class CreateCollectionDataDto {
  @ApiProperty({
    description: 'New collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

class UpdateCollectionDataDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'My Favorite Quizzes' })
  name!: string;

  @ApiPropertyOptional({ description: 'Collection description', type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}

class BookmarkStatsFavoriteCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Category URL slug', example: 'science' })
  slug!: string;
}

class BookmarkStatsFavoriteTagDataDto {
  @ApiProperty({ description: 'Tag identifier', example: '550e8400-e29b-41d4-a716-446655440002' })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;

  @ApiProperty({ description: 'Tag URL slug', example: 'physics' })
  slug!: string;
}

class BookmarkStatsDataDto {
  @ApiProperty({ description: 'Total number of bookmark collections', example: 3 })
  totalCollections!: number;

  @ApiProperty({ description: 'Total bookmarked quizzes across all collections', example: 27 })
  totalBookmarks!: number;

  @ApiPropertyOptional({
    description: 'Category with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: BookmarkStatsFavoriteCategoryDataDto,
    nullable: true,
  })
  favoriteCategory!: BookmarkStatsFavoriteCategoryDataDto | null;

  @ApiPropertyOptional({
    description: 'Tag with the most bookmarked quizzes. Null if no bookmarks exist.',
    type: BookmarkStatsFavoriteTagDataDto,
    nullable: true,
  })
  favoriteTag!: BookmarkStatsFavoriteTagDataDto | null;
}

class RecentBookmarkItemDataDto {
  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
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

  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

class SearchBookmarkItemDataDto {
  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
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

  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'React Learning' })
  collectionName!: string;

  @ApiProperty({
    description: 'Bookmark creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  bookmarkedAt!: string;
}

class CollectionAnalyticsSummaryDataDto {
  @ApiProperty({ description: 'Total bookmarks in this collection', example: 24 })
  totalBookmarks!: number;

  @ApiProperty({ description: 'Number of unique quizzes', example: 24 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Average rating across quizzes in this collection', example: 4.2 })
  averageQuizRating!: number;

  @ApiProperty({ description: 'Number of unique categories', example: 6 })
  uniqueCategories!: number;

  @ApiProperty({ description: 'Number of unique tags', example: 11 })
  uniqueTags!: number;
}

class CollectionAnalyticsTopCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;

  @ApiProperty({ description: 'Category URL slug', example: 'science' })
  slug!: string;

  @ApiProperty({ description: 'Number of bookmarks in this category', example: 8 })
  bookmarkCount!: number;
}

class CollectionAnalyticsTopTagDataDto {
  @ApiProperty({ description: 'Tag identifier', example: '880e8400-e29b-41d4-a716-446655440000' })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;

  @ApiProperty({ description: 'Tag URL slug', example: 'physics' })
  slug!: string;

  @ApiProperty({ description: 'Number of bookmarks with this tag', example: 5 })
  bookmarkCount!: number;
}

class CollectionAnalyticsDataDto {
  @ApiProperty({
    description: 'Collection identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  collectionId!: string;

  @ApiProperty({ description: 'Collection name', example: 'Frontend Study List' })
  collectionName!: string;

  @ApiProperty({
    description: 'Bookmark statistics for this collection',
    type: CollectionAnalyticsSummaryDataDto,
  })
  summary!: CollectionAnalyticsSummaryDataDto;

  @ApiProperty({
    description: 'Top categories by bookmark count',
    type: [CollectionAnalyticsTopCategoryDataDto],
  })
  topCategories!: CollectionAnalyticsTopCategoryDataDto[];

  @ApiProperty({
    description: 'Top tags by bookmark count',
    type: [CollectionAnalyticsTopTagDataDto],
  })
  topTags!: CollectionAnalyticsTopTagDataDto[];

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}

class MessageDataDto {
  @ApiProperty({ description: 'Result message', example: 'Bookmark removed successfully' })
  message!: string;
}

// ─── Meta types ────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({ description: 'Number of items returned in this page', example: 10 })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Cursor-based pagination metadata', type: PaginationMetaDataDto })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class WrappedBookmarkStatusDto {
  @ApiProperty({ description: 'Wrapped bookmark status', type: BookmarkStatusDataDto })
  data!: BookmarkStatusDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBookmarkCollectionsDto {
  @ApiProperty({
    description: 'Bookmark collections owned by the authenticated user',
    type: [BookmarkCollectionDataDto],
  })
  data!: BookmarkCollectionDataDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBookmarkListDto {
  @ApiProperty({
    description: 'Bookmarked quizzes in the collection',
    type: [BookmarkedQuizDataDto],
  })
  data!: BookmarkedQuizDataDto[];

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedSearchBookmarksDto {
  @ApiProperty({
    description: 'Search results for bookmarked quizzes',
    type: [SearchBookmarkItemDataDto],
  })
  data!: SearchBookmarkItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedRecentBookmarksDto {
  @ApiProperty({ description: 'Recently bookmarked quizzes', type: [RecentBookmarkItemDataDto] })
  data!: RecentBookmarkItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedCreateCollectionDto {
  @ApiProperty({ description: 'Wrapped create collection result', type: CreateCollectionDataDto })
  data!: CreateCollectionDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedAddBookmarkDto {
  @ApiProperty({ description: 'Wrapped add bookmark result', type: AddBookmarkDataDto })
  data!: AddBookmarkDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBulkAddDto {
  @ApiProperty({ description: 'Wrapped bulk add result', type: BulkAddDataDto })
  data!: BulkAddDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBulkRemoveDto {
  @ApiProperty({ description: 'Wrapped bulk remove result', type: BulkRemoveDataDto })
  data!: BulkRemoveDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedRemoveBookmarkDto {
  @ApiProperty({ description: 'Wrapped remove bookmark result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedUpdateBookmarkDto {
  @ApiProperty({ description: 'Wrapped update bookmark result', type: UpdateBookmarkDataDto })
  data!: UpdateBookmarkDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMoveBookmarkDto {
  @ApiProperty({ description: 'Wrapped move bookmark result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedUpdateCollectionDto {
  @ApiProperty({ description: 'Wrapped update collection result', type: UpdateCollectionDataDto })
  data!: UpdateCollectionDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedBookmarkStatsDto {
  @ApiProperty({ description: 'Wrapped bookmark statistics', type: BookmarkStatsDataDto })
  data!: BookmarkStatsDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedDeleteCollectionDto {
  @ApiProperty({ description: 'Wrapped delete collection result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedCollectionAnalyticsDto {
  @ApiProperty({ description: 'Wrapped collection analytics', type: CollectionAnalyticsDataDto })
  data!: CollectionAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
