import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizMetricsDto {
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

export class ReviewMetricsDto {
  @ApiProperty({
    description: 'Average user rating (1–5)',
    example: 4.3,
  })
  averageRating!: number;

  @ApiProperty({ description: 'Total number of ratings submitted', example: 312 })
  ratingCount!: number;
}

export class EngagementMetricsDto {
  @ApiProperty({ description: 'Number of times the quiz has been bookmarked', example: 95 })
  bookmarkCount!: number;
}

export class PopularityDto {
  @ApiProperty({ description: 'Composite popularity score', example: 87.6 })
  popularityScore!: number;

  @ApiProperty({ description: 'Short-term trending score based on recent activity', example: 45.2 })
  trendingScore!: number;

  @ApiPropertyOptional({ description: 'Overall popularity rank position', example: 12 })
  rank?: number;
}

export class QuizAnalyticsResponseDto {
  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz attempt and score metrics', type: () => QuizMetricsDto })
  metrics!: QuizMetricsDto;

  @ApiProperty({ description: 'User review metrics', type: () => ReviewMetricsDto })
  reviewMetrics!: ReviewMetricsDto;

  @ApiProperty({ description: 'Engagement metrics', type: () => EngagementMetricsDto })
  engagementMetrics!: EngagementMetricsDto;

  @ApiProperty({ description: 'Popularity and trending scores', type: () => PopularityDto })
  popularity!: PopularityDto;

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh',
    example: '2026-07-13 09:11:05.026+00',
  })
  lastUpdated!: string;
}

export class TrendingQuizItemDto {
  @ApiProperty({ description: 'Trending rank position', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Creator user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  creatorId!: string | null;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'URL-friendly quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/covers/js.png',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Trending score for this period', example: 45.2 })
  trendingScore!: number;

  @ApiProperty({ description: 'Total number of attempts', example: 1250 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Attempts in the current trending window', example: 320 })
  recentAttempts!: number;
}

export class TrendingQuizzesResponseDto {
  @ApiProperty({
    description: 'Trending period',
    enum: ['daily', 'weekly'],
    example: 'weekly',
  })
  period!: 'daily' | 'weekly';

  @ApiProperty({
    description: 'Trending quiz items sorted by rank',
    type: () => [TrendingQuizItemDto],
  })
  quizzes!: TrendingQuizItemDto[];

  @ApiProperty({
    description: 'Timestamp of the last trending refresh',
    example: '2026-07-13 09:11:05.026+00',
  })
  lastUpdated!: string;
}

export class PopularQuizItemDto {
  @ApiProperty({ description: 'Popularity rank position', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Creator user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  creatorId!: string | null;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'URL-friendly quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/covers/js.png',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Composite popularity score', example: 87.6 })
  popularityScore!: number;

  @ApiProperty({ description: 'Total number of attempts', example: 1250 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Average user rating (1–5)', example: 4.3 })
  averageRating!: number;

  @ApiProperty({ description: 'Number of bookmarks', example: 95 })
  bookmarkCount!: number;
}

export class PopularQuizzesResponseDto {
  @ApiProperty({
    description: 'Popular quiz items sorted by rank',
    type: () => [PopularQuizItemDto],
  })
  quizzes!: PopularQuizItemDto[];

  @ApiProperty({
    description: 'Timestamp of the last popularity refresh',
    example: '2026-07-13 09:11:05.026+00',
  })
  lastUpdated!: string;
}

export class CategorySummaryDto {
  @ApiProperty({ description: 'Total quizzes in this category', example: 48 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Quizzes that are currently published and active', example: 40 })
  activeQuizzes!: number;

  @ApiProperty({ description: 'Total attempts across all quizzes in this category', example: 5200 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Unique players across all quizzes in this category', example: 3100 })
  totalPlayers!: number;

  @ApiProperty({ description: 'Average score percent across the category (0–100)', example: 68.5 })
  averageScore!: number;

  @ApiProperty({ description: 'Average rating across the category (1–5)', example: 4.1 })
  averageRating!: number;
}

export class CategoryAnalyticsResponseDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Programming' })
  categoryName!: string;

  @ApiProperty({ description: 'Aggregate summary metrics', type: () => CategorySummaryDto })
  summary!: CategorySummaryDto;

  @ApiProperty({
    description: 'Top performing quizzes in this category',
    type: () => [PopularQuizItemDto],
  })
  topQuizzes!: PopularQuizItemDto[];

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh',
    example: '2026-07-13 09:11:05.026+00',
  })
  lastUpdated!: string;
}

export class CreatorQuizAnalyticsDto {
  @ApiProperty({
    description: 'Creator user identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Total quizzes created by the creator', example: 12 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Total draft quizzes owned by the creator', example: 3 })
  draftQuizzes!: number;

  @ApiProperty({ description: 'Total published quizzes owned by the creator', example: 9 })
  publishedQuizzes!: number;

  @ApiProperty({ description: 'Total attempts across all creator quizzes', example: 4800 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Total unique players across all creator quizzes', example: 2900 })
  totalPlayers!: number;

  @ApiProperty({ description: 'Average score across all creator quizzes (0–100)', example: 76.4 })
  averageScore!: number;

  @ApiProperty({ description: 'Average rating across all creator quizzes (1–5)', example: 4.4 })
  averageRating!: number;

  @ApiProperty({ description: 'Total bookmarks across all creator quizzes', example: 510 })
  totalBookmarks!: number;

  @ApiProperty({ description: 'Total reviews across all creator quizzes', example: 310 })
  totalReviews!: number;

  @ApiProperty({
    description: 'Timestamp of the last analytics refresh',
    example: '2026-07-13 09:11:05.026+00',
  })
  lastUpdated!: string;
}
