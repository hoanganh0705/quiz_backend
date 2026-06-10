import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
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

  @ApiPropertyOptional({ description: 'Reviewer avatar URL', format: 'uri', nullable: true })
  userAvatarUrl!: string | null;

  @ApiProperty({ description: 'Star rating (1–5)', example: 4 })
  rating!: number;

  @ApiPropertyOptional({ description: 'Review text', nullable: true })
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
}

export class ReviewPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({ description: 'Cursor for next page', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: false })
  hasNextPage!: boolean;
}

export class ReviewListResponseDto {
  @ApiProperty({ description: 'Review items', type: () => [ReviewResponseDto] })
  items!: ReviewResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => ReviewPaginationResponseDto })
  pagination!: ReviewPaginationResponseDto;
}

export class MyReviewItemDto {
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

  @ApiProperty({
    description: 'Reviewed quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 5 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Written review content',
    example: 'Excellent quiz',
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;
}

export class MyReviewsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items are available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXZpZXdJZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA5OSJ9',
    nullable: true,
  })
  nextCursor!: string | null;
}

export class MyReviewsResponseDto {
  @ApiProperty({ description: 'Authenticated user review items', type: () => [MyReviewItemDto] })
  items!: MyReviewItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => MyReviewsPaginationDto })
  pagination!: MyReviewsPaginationDto;
}

export class ReviewDetailResponseDto {
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

  @ApiProperty({
    description: 'Reviewed quiz title',
    example: 'JavaScript Fundamentals',
  })
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

  @ApiPropertyOptional({
    description: 'Written review content',
    example: 'Excellent quiz',
    nullable: true,
  })
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
}

export class ReviewRatingDistributionDto {
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

export class ReviewStatsResponseDto {
  @ApiProperty({ description: 'Average rating for the quiz', example: 4.7 })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of reviews for the quiz', example: 1250 })
  totalReviews!: number;

  @ApiProperty({
    description: 'Distribution of reviews by star rating',
    type: () => ReviewRatingDistributionDto,
  })
  ratingDistribution!: ReviewRatingDistributionDto;
}

export class ReviewDashboardFavoriteCategoryDto {
  @ApiProperty({ format: 'uuid', example: '770e8400-e29b-41d4-a716-446655440000' })
  categoryId!: string;

  @ApiProperty({ example: 'Science' })
  name!: string;
}

export class ReviewDashboardFavoriteTagDto {
  @ApiProperty({ format: 'uuid', example: '880e8400-e29b-41d4-a716-446655440000' })
  tagId!: string;

  @ApiProperty({ example: 'Biology' })
  name!: string;
}

export class ReviewDashboardResponseDto {
  @ApiProperty({
    description: 'Total number of reviews created by the authenticated user',
    example: 85,
  })
  totalReviews!: number;

  @ApiProperty({ description: 'Average rating given by the authenticated user', example: 4.2 })
  averageRatingGiven!: number;

  @ApiPropertyOptional({
    description: 'Most reviewed category across the authenticated user reviews',
    type: () => ReviewDashboardFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: ReviewDashboardFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Most reviewed tag across the authenticated user reviews',
    type: () => ReviewDashboardFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: ReviewDashboardFavoriteTagDto | null;

  @ApiProperty({
    description: 'Timestamp when the dashboard was last calculated',
    example: '2026-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}

export class CreateReviewResponseDto {
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

  @ApiPropertyOptional({ description: 'Review text', nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

export class UpdateReviewResponseDto {
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

  @ApiPropertyOptional({ description: 'Updated review text', nullable: true })
  comment!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-02T08:00:00.000Z',
  })
  updatedAt!: string;
}

export class DeleteReviewResponseDto {
  @ApiProperty({ description: 'Deletion confirmation', example: 'Review deleted successfully' })
  message!: string;
}

export class HelpfulReviewResponseDto {
  @ApiProperty({
    description: 'Helpful vote operation result',
    example: 'Review marked as helpful',
  })
  message!: string;
}

export class ReportReviewResponseDto {
  @ApiProperty({
    description: 'Review report operation result',
    example: 'Review reported successfully',
  })
  message!: string;
}

export class MyQuizReviewResponseDto {
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

  @ApiProperty({
    description: 'Reviewed quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Reviewer user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Reviewer username', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Star rating (1–5)', example: 4 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Written review content',
    example: 'Excellent quiz',
    nullable: true,
  })
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
}

export class ReportedReviewItemDto {
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

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Username of the review author',
    example: 'bob_builder',
  })
  reviewerUsername!: string;

  @ApiProperty({ description: 'Star rating of the reported review (1–5)', example: 1 })
  rating!: number;

  @ApiPropertyOptional({
    description: 'Content of the reported review',
    example: 'This quiz is terrible!',
    nullable: true,
  })
  content!: string | null;

  @ApiProperty({
    description: 'Reason for reporting the review',
    example: 'spam',
  })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional moderation details provided by the reporter',
    example: 'Contains advertising links',
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
}

export class ReportedReviewsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiProperty({ description: 'Whether more items are available', example: false })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJyZXBvcnRJZCI6Ijk5MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMSJ9',
    nullable: true,
  })
  nextCursor!: string | null;
}

export class ReportedReviewsResponseDto {
  @ApiProperty({
    description: 'Reported review items submitted by the authenticated user',
    type: () => [ReportedReviewItemDto],
  })
  items!: ReportedReviewItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => ReportedReviewsPaginationDto,
  })
  pagination!: ReportedReviewsPaginationDto;
}
