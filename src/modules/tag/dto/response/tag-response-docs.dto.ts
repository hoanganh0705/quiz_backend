import { ApiProperty } from '@nestjs/swagger';

// ─── Tag module documentation-only wrapper DTOs ────────────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// Runtime DTO classes (TagResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class TagDataDto {
  @ApiProperty({
    description: 'Unique tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'JavaScript',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript',
  })
  slug!: string;

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

class RankedTagDataDto {
  @ApiProperty({
    description: '1-based rank position',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'Unique tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'JavaScript',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript',
  })
  slug!: string;

  @ApiProperty({
    description: 'Aggregated popularity or trending score (numeric string)',
    example: '980.5',
  })
  totalScore!: string;

  @ApiProperty({
    description: 'Total quiz attempts across linked active quizzes (numeric string)',
    example: '4200',
  })
  totalAttempts!: string;
}

class TagFollowDataDto {
  @ApiProperty({
    description: 'Confirmation message',
    example: 'Tag followed successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Whether the requested follow state changed',
    example: true,
  })
  changed!: boolean;
}

class TagDeleteDataDto {
  @ApiProperty({
    description: 'Deletion confirmation',
    example: 'Tag deleted successfully',
  })
  message!: string;
}

class TagAnalyticsSummaryDataDto {
  @ApiProperty({
    description: 'Total quizzes in this tag',
    example: 12,
  })
  totalQuizzes!: number;

  @ApiProperty({
    description: 'Number of active (published) quizzes',
    example: 10,
  })
  activeQuizzes!: number;

  @ApiProperty({
    description: 'Total number of attempts across all quizzes in this tag',
    example: 2480,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of unique players who attempted quizzes in this tag',
    example: 920,
  })
  totalPlayers!: number;

  @ApiProperty({
    description: 'Average score across all attempts in this tag (0–100)',
    example: 78.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average user rating across all quizzes in this tag (1–5)',
    example: 4.6,
  })
  averageRating!: number;
}

class TagAnalyticsTopQuizDataDto {
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

class TagAnalyticsDataDto {
  @ApiProperty({
    description: 'Tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'JavaScript',
  })
  tagName!: string;

  @ApiProperty({
    description: 'Summary statistics across all quizzes in this tag',
    type: () => TagAnalyticsSummaryDataDto,
  })
  summary!: TagAnalyticsSummaryDataDto;

  @ApiProperty({
    description: 'Top quizzes in this tag by popularity',
    type: () => [TagAnalyticsTopQuizDataDto],
  })
  topQuizzes!: TagAnalyticsTopQuizDataDto[];

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}

class FollowedTagDataDto {
  @ApiProperty({
    description: 'Tag identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag name',
    example: 'JavaScript',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug',
    example: 'javascript',
  })
  slug!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user followed this tag',
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

// ─── Nested list payloads (for non-paginated endpoints) ───────────────────────
//
// Endpoints that return `{ items }` without a `pagination` field are wrapped by
// the response interceptor as `{ data: { items: [...] }, meta: { timestamp } }`,
// not flattened to `{ data: [...], meta: { ..., pagination } }`. These inner
// classes document that nested `data` shape for Swagger.
class TagRankedListDataDto {
  @ApiProperty({
    description: 'Ranked tag items',
    type: () => [RankedTagDataDto],
  })
  items!: RankedTagDataDto[];
}

class TagRelatedListDataDto {
  @ApiProperty({
    description: 'Related tag items',
    type: () => [TagDataDto],
  })
  items!: TagDataDto[];
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class TagWrappedRankedListDto {
  @ApiProperty({
    description:
      'Wrapped ranked tag list. `data` is an object (not an array) because the endpoint returns `{ items }` without a `pagination` cursor, so the response interceptor does not flatten it.',
    type: () => TagRankedListDataDto,
  })
  data!: TagRankedListDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedRelatedListDto {
  @ApiProperty({
    description:
      'Wrapped related tag list. `data` is an object (not an array) because the endpoint returns `{ items }` without a `pagination` cursor, so the response interceptor does not flatten it.',
    type: () => TagRelatedListDataDto,
  })
  data!: TagRelatedListDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedAnalyticsDto {
  @ApiProperty({
    description: 'Tag analytics payload',
    type: () => TagAnalyticsDataDto,
  })
  data!: TagAnalyticsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedFollowMessageDto {
  @ApiProperty({
    description: 'Follow/unfollow result payload',
    type: () => TagFollowDataDto,
  })
  data!: TagFollowDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedDeleteMessageDto {
  @ApiProperty({
    description: 'Deletion confirmation payload',
    type: () => TagDeleteDataDto,
  })
  data!: TagDeleteDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedTagDto {
  @ApiProperty({
    description: 'Tag payload',
    type: () => TagDataDto,
  })
  data!: TagDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: () => MetaDto,
  })
  meta!: MetaDto;
}

export class TagWrappedListDto {
  @ApiProperty({
    description: 'Paginated tag items',
    type: () => [TagDataDto],
  })
  data!: TagDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: () => PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}

export class TagWrappedFollowedListDto {
  @ApiProperty({
    description: 'Paginated followed tag items',
    type: () => [FollowedTagDataDto],
  })
  data!: FollowedTagDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: () => PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}
