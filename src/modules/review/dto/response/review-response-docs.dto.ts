import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Review module documentation-only wrapper DTOs ────────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// Runtime DTO classes (ReviewResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class ReviewItemDataDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Reviewer user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Reviewer username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Reviewer avatar URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  userAvatarUrl!: string | null;

  @ApiProperty({ description: 'Star rating (1–5)', example: 4 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Review text', type: String, nullable: true })
  comment!: string | null;

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

  @ApiProperty({ description: 'Number of users who found this review helpful', example: 42 })
  helpfulCount!: number;
}

class ReviewDetailDataDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Reviewed quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Reviewed quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({
    description: 'Reviewer user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Reviewer username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 5 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Written review content', type: String, nullable: true })
  content!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({ description: 'Number of users who found this review helpful', example: 42 })
  helpfulCount!: number;
}

class CreateReviewDataDto {
  @ApiProperty({
    description: 'New review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Star rating', example: 4 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Review text', type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

class UpdateReviewDataDto {
  @ApiProperty({
    description: 'Review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Updated star rating', example: 5 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Updated review text', type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}

class ReviewRatingDistributionDataDto {
  @ApiProperty({ description: 'Number of 1-star reviews', example: 12 })
  '1'!: number;

  @ApiProperty({ description: 'Number of 2-star reviews', example: 20 })
  '2'!: number;

  @ApiProperty({ description: 'Number of 3-star reviews', example: 55 })
  '3'!: number;

  @ApiProperty({ description: 'Number of 4-star reviews', example: 300 })
  '4'!: number;

  @ApiProperty({ description: 'Number of 5-star reviews', example: 863 })
  '5'!: number;
}

class ReviewStatsDataDto {
  @ApiProperty({ description: 'Average rating for the quiz', example: 4.7 })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of reviews for the quiz', example: 1250 })
  totalReviews!: number;

  @ApiProperty({
    description: 'Distribution of reviews by star rating',
    type: ReviewRatingDistributionDataDto,
  })
  ratingDistribution!: ReviewRatingDistributionDataDto;
}

class ReviewDashboardFavoriteCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

class ReviewDashboardFavoriteTagDataDto {
  @ApiProperty({ description: 'Tag identifier', example: '880e8400-e29b-41d4-a716-446655440000' })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Biology' })
  name!: string;
}

class ReviewDashboardDataDto {
  @ApiProperty({
    description: 'Total number of reviews created by the authenticated user',
    example: 85,
  })
  totalReviews!: number;

  @ApiProperty({ description: 'Average rating given by the authenticated user', example: 4.2 })
  averageRatingGiven!: number;

  @ApiPropertyOptional({
    description: 'Most reviewed category across the authenticated user reviews',
    type: ReviewDashboardFavoriteCategoryDataDto,
    nullable: true,
  })
  favoriteCategory!: ReviewDashboardFavoriteCategoryDataDto | null;

  @ApiPropertyOptional({
    description: 'Most reviewed tag across the authenticated user reviews',
    type: ReviewDashboardFavoriteTagDataDto,
    nullable: true,
  })
  favoriteTag!: ReviewDashboardFavoriteTagDataDto | null;

  @ApiProperty({
    description: 'Timestamp when the dashboard was last calculated (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

class MyReviewItemDataDto {
  @ApiProperty({
    description: 'Unique review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({
    description: 'Reviewed quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Reviewed quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 5 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Written review content', type: String, nullable: true })
  content!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Last update timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt!: string | null;
}

class ReportedReviewItemDataDto {
  @ApiProperty({
    description: 'Unique report identifier',
    example: '990e8400-e29b-41d4-a716-446655440001',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reported review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Username of the review author', example: 'bob_builder' })
  reviewerUsername!: string;

  @ApiProperty({ description: 'Star rating of the reported review (1–5)', example: 1 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Content of the reported review',
    type: String,
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({ description: 'Reason for reporting the review', example: 'spam' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details',
    type: String,
    nullable: true,
  })
  details!: string | null;

  @ApiProperty({
    description: 'Current status of the report',
    example: 'open',
    enum: ['open', 'reviewed', 'dismissed', 'actioned'],
  })
  status!: 'open' | 'reviewed' | 'dismissed' | 'actioned';

  @ApiProperty({
    description: 'Timestamp when the report was created (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the report was last updated (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt!: string | null;
}

class PlatformReportItemDataDto {
  @ApiProperty({
    description: 'Unique report identifier',
    example: '990e8400-e29b-41d4-a716-446655440001',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reported review identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  reviewId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({
    description: 'Username of the person who reported the review',
    example: 'bob_builder',
  })
  reviewerUsername!: string;

  @ApiProperty({
    description: 'User ID of the review author who was reported',
    example: '770e8400-e29b-41d4-a716-446655440001',
  })
  reportedUserId!: string;

  @ApiProperty({ description: 'Star rating of the reported review (1–5)', example: 1 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Content of the reported review',
    type: String,
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({ description: 'Reason for reporting the review', example: 'spam' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details',
    type: String,
    nullable: true,
  })
  details!: string | null;

  @ApiProperty({
    description: 'Current status of the report',
    example: 'open',
    enum: ['open', 'reviewed', 'dismissed', 'actioned'],
  })
  status!: 'open' | 'reviewed' | 'dismissed' | 'actioned';

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Last update timestamp (ISO 8601)',
    type: String,
    nullable: true,
  })
  updatedAt!: string | null;
}

class MessageDataDto {
  @ApiProperty({ description: 'Result message', example: 'Operation completed successfully' })
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
  @ApiProperty({ description: 'Number of items returned in this page', example: 20 })
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

export class WrappedReviewDetailDto {
  @ApiProperty({ description: 'Wrapped review detail', type: ReviewDetailDataDto })
  data!: ReviewDetailDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMyDashboardDto {
  @ApiProperty({ description: 'Wrapped review dashboard', type: ReviewDashboardDataDto })
  data!: ReviewDashboardDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedHelpfulMessageDto {
  @ApiProperty({ description: 'Wrapped helpful vote result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedReportMessageDto {
  @ApiProperty({ description: 'Wrapped report result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedReviewListDto {
  @ApiProperty({ description: 'Paginated review items', type: [ReviewItemDataDto] })
  data!: ReviewItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedReviewStatsDto {
  @ApiProperty({ description: 'Wrapped review statistics', type: ReviewStatsDataDto })
  data!: ReviewStatsDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedCreateReviewDto {
  @ApiProperty({ description: 'Wrapped create review result', type: CreateReviewDataDto })
  data!: CreateReviewDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedUpdateReviewDto {
  @ApiProperty({ description: 'Wrapped update review result', type: UpdateReviewDataDto })
  data!: UpdateReviewDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedDeleteMessageDto {
  @ApiProperty({ description: 'Wrapped delete result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMyReviewDto {
  @ApiProperty({
    description: 'Wrapped my review for a quiz (null if no review exists)',
    type: ReviewDetailDataDto,
    nullable: true,
  })
  data!: ReviewDetailDataDto | null;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}

export class WrappedMyReviewsListDto {
  @ApiProperty({ description: 'Paginated my reviews items', type: [MyReviewItemDataDto] })
  data!: MyReviewItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedReportedReviewsListDto {
  @ApiProperty({
    description: 'Paginated reported reviews items',
    type: [ReportedReviewItemDataDto],
  })
  data!: ReportedReviewItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedPlatformReportsListDto {
  @ApiProperty({
    description: 'Paginated platform reports items',
    type: [PlatformReportItemDataDto],
  })
  data!: PlatformReportItemDataDto[];

  @ApiProperty({ description: 'Response metadata with pagination', type: PaginatedMetaDto })
  meta!: PaginatedMetaDto;
}

export class WrappedUpdateReportMessageDto {
  @ApiProperty({ description: 'Wrapped update report result', type: MessageDataDto })
  data!: MessageDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
