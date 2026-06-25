import { ApiProperty } from '@nestjs/swagger';

// ─── Category module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// Runtime DTO classes (CategoryResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class RankedCategoryDataDto {
  @ApiProperty({
    description: '1-based rank position',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'Unique category identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'General Knowledge',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'general-knowledge',
  })
  slug!: string;

  @ApiProperty({
    description: 'Category cover image URL',
    type: String,
    nullable: true,
    example: 'https://example.com/images/general-knowledge.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Category description',
    type: String,
    nullable: true,
    example: 'Test your knowledge across topics',
  })
  description!: string | null;

  @ApiProperty({
    description: 'Aggregated popularity or trending score (numeric string)',
    example: '1250.5',
  })
  totalScore!: string;

  @ApiProperty({
    description: 'Total quiz attempts across linked active quizzes (numeric string)',
    example: '4800',
  })
  totalAttempts!: string;
}

class CategoryDataDto {
  @ApiProperty({
    description: 'Unique category identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'General Knowledge',
  })
  name!: string;

  @ApiProperty({
    description: 'Category description',
    type: String,
    nullable: true,
    example: 'Test your knowledge across topics',
  })
  description!: string | null;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'general-knowledge',
  })
  slug!: string;

  @ApiProperty({
    description: 'Category cover image URL',
    type: String,
    format: 'uri',
    nullable: true,
    example: 'https://example.com/images/general-knowledge.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

class CategoryMessageDataDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Operation completed successfully',
  })
  message!: string;
}

class CategoryAnalyticsSummaryDataDto {
  @ApiProperty({
    description: 'Total quizzes in this category',
    example: 12,
  })
  totalQuizzes!: number;

  @ApiProperty({
    description: 'Number of active (published) quizzes',
    example: 10,
  })
  activeQuizzes!: number;

  @ApiProperty({
    description: 'Total number of attempts across all quizzes in this category',
    example: 2480,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of unique players who attempted quizzes in this category',
    example: 920,
  })
  totalPlayers!: number;

  @ApiProperty({
    description: 'Average score across all attempts in this category (0–100)',
    example: 78.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average user rating across all quizzes in this category (1–5)',
    example: 4.6,
  })
  averageRating!: number;
}

class CategoryAnalyticsTopQuizDataDto {
  @ApiProperty({
    description: 'Popularity rank position',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  title!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: 'Quiz cover image URL',
    type: String,
    nullable: true,
    example: 'https://example.com/covers/js.png',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Composite popularity score',
    example: 87.6,
  })
  popularityScore!: number;

  @ApiProperty({
    description: 'Total number of attempts',
    example: 1250,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Average user rating (1–5)',
    example: 4.3,
  })
  averageRating!: number;

  @ApiProperty({
    description: 'Number of bookmarks',
    example: 95,
  })
  bookmarkCount!: number;
}

class CategoryAnalyticsDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Science',
  })
  categoryName!: string;

  @ApiProperty({
    description: 'Summary statistics across all quizzes in this category',
    type: CategoryAnalyticsSummaryDataDto,
  })
  summary!: CategoryAnalyticsSummaryDataDto;

  @ApiProperty({
    description: 'Top quizzes in this category by popularity',
    type: [CategoryAnalyticsTopQuizDataDto],
  })
  topQuizzes!: CategoryAnalyticsTopQuizDataDto[];

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}

class FollowedCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'General Knowledge',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'general-knowledge',
  })
  slug!: string;

  @ApiProperty({
    description: 'Category cover image URL',
    type: String,
    nullable: true,
    example: 'https://example.com/images/general-knowledge.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Category description',
    type: String,
    nullable: true,
    example: 'Test your knowledge across topics',
  })
  description!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user followed this category',
    example: '2025-06-05T14:30:00.000Z',
  })
  followedAt!: string;
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
  @ApiProperty({
    description: 'Number of items returned in this page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Whether more items exist after this page',
    example: true,
  })
  hasNextPage!: boolean;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Cursor-based pagination metadata',
    type: PaginationMetaDataDto,
  })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class CategoryWrappedRankedListDto {
  @ApiProperty({
    description: 'Ranked category items',
    type: [RankedCategoryDataDto],
  })
  data!: RankedCategoryDataDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class CategoryWrappedRelatedListDto {
  @ApiProperty({
    description: 'Related category items',
    type: [CategoryDataDto],
  })
  data!: CategoryDataDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class CategoryWrappedAnalyticsDto {
  @ApiProperty({
    description: 'Wrapped category analytics',
    type: CategoryAnalyticsDataDto,
  })
  data!: CategoryAnalyticsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class CategoryWrappedMessageDto {
  @ApiProperty({
    description: 'Wrapped response payload',
    type: CategoryMessageDataDto,
  })
  data!: CategoryMessageDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class CategoryWrappedCategoryDto {
  @ApiProperty({
    description: 'Wrapped category details',
    type: CategoryDataDto,
  })
  data!: CategoryDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class CategoryWrappedListDto {
  @ApiProperty({
    description: 'Paginated category items',
    type: [CategoryDataDto],
  })
  data!: CategoryDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}

export class CategoryWrappedFollowedListDto {
  @ApiProperty({
    description: 'Paginated followed category items',
    type: [FollowedCategoryDataDto],
  })
  data!: FollowedCategoryDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}
