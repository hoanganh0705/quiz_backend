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
// Two distinct runtime error shapes must be documented:
//
//   1. Global / Nest HttpException errors
//      (400 from class-validator, 401 from JwtGuard, 403 from PermissionsGuard,
//       500 from unhandled errors)
//      → handled by GlobalExceptionFilter → emits RFC 7807 ProblemDetail
//        { type, title, status, detail, instance, extensions }
//
//   2. Review domain errors
//      (ReviewNotFoundError, ReviewForbiddenError, ReviewConflictError,
//       ReviewValidationError, ReviewAttemptRequiredError, ReviewAlreadyReportedError)
//      → handled by ReviewDomainExceptionFilter → emits
//        { statusCode: number, message: string, error: string }
//
// Both shapes are documented below.

// ─── Error response schemas ─────────────────────────────────────────────────────

export class ReviewDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the review domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Human-readable message produced by the review domain exception filter',
    example: 'Review not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the review domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}

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
  @ApiProperty({
    description: 'Result message returned by the endpoint',
    example: 'Review marked as helpful',
  })
  message!: string;
}

// Quiz analytics shape returned by GET /api/v1/quizzes/{quizId}/reviews/analytics.
// Mirrors QuizAnalyticsResponseDto from the quiz module (per-quiz analytics), NOT
// CreatorAnalyticsDataDto (which is per-creator analytics for /me/analytics).
class QuizAnalyticsMetricsDataDto {
  @ApiProperty({ description: 'Total number of quiz attempts', example: 1250 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Number of unique players who attempted the quiz', example: 820 })
  uniquePlayers!: number;

  @ApiProperty({
    description: 'Average score percent across all attempts (0–100)',
    example: 72.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Proportion of attempts that reached the end (0–1)',
    example: 0.85,
  })
  completionRate!: number;
}

class QuizAnalyticsReviewMetricsDataDto {
  @ApiProperty({ description: 'Average user rating (1–5)', example: 4.3 })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of ratings submitted', example: 312 })
  ratingCount!: number;
}

class QuizAnalyticsEngagementMetricsDataDto {
  @ApiProperty({ description: 'Number of times the quiz has been bookmarked', example: 95 })
  bookmarkCount!: number;
}

class QuizAnalyticsPopularityDataDto {
  @ApiProperty({ description: 'Composite popularity score', example: 87.6 })
  popularityScore!: number;

  @ApiProperty({
    description: 'Short-term trending score based on recent activity',
    example: 45.2,
  })
  trendingScore!: number;
}

class QuizAnalyticsDataDto {
  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz attempt and score metrics',
    type: QuizAnalyticsMetricsDataDto,
  })
  metrics!: QuizAnalyticsMetricsDataDto;

  @ApiProperty({
    description: 'User review metrics',
    type: QuizAnalyticsReviewMetricsDataDto,
  })
  reviewMetrics!: QuizAnalyticsReviewMetricsDataDto;

  @ApiProperty({
    description: 'Engagement metrics',
    type: QuizAnalyticsEngagementMetricsDataDto,
  })
  engagementMetrics!: QuizAnalyticsEngagementMetricsDataDto;

  @ApiProperty({
    description: 'Popularity and trending scores',
    type: QuizAnalyticsPopularityDataDto,
  })
  popularity!: QuizAnalyticsPopularityDataDto;

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh (ISO 8601)',
    example: '2025-06-01T00:00:00.000Z',
  })
  lastUpdated!: string;
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
    description:
      'Opaque cursor for fetching the next page. `null` when there is no next page. ' +
      'Pass this value as the `cursor` query parameter on the next request to continue pagination.',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiAiMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaIiwgInJldmlld0lkIjogIjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
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
    description:
      'The authenticated user review for the requested quiz. ' +
      '`null` when the user has not reviewed the quiz yet.',
    type: ReviewDetailDataDto,
    nullable: true,
    example: null,
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

export class WrappedQuizAnalyticsDto {
  @ApiProperty({
    description: 'Per-quiz analytics returned by the quiz analytics service',
    type: QuizAnalyticsDataDto,
  })
  data!: QuizAnalyticsDataDto;

  @ApiProperty({ description: 'Response metadata', type: MetaDto })
  meta!: MetaDto;
}
