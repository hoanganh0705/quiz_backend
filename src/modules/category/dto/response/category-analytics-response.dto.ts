import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CategoryAnalyticsSummaryDto {
  @ApiProperty({ description: 'Total quizzes in the category (any status)', example: 12 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Number of currently active quizzes in the category', example: 10 })
  activeQuizzes!: number;

  @ApiProperty({
    description: 'Cumulative attempt count across all active quizzes in the category',
    example: 2480,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of distinct users who attempted any quiz in the category',
    example: 920,
  })
  uniquePlayers!: number;

  @ApiProperty({
    description: 'Average score percent across attempts in the category',
    example: 78.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average review rating across quizzes in the category (0–5 scale)',
    example: 4.6,
  })
  averageRating!: number;
}

export class CategoryAnalyticsTopQuizDto {
  @ApiProperty({
    description: '1-based rank within the category, sorted by popularity score',
    example: 1,
  })
  rank!: number;

  @ApiProperty({ description: 'Quiz identifier', format: 'uuid' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ description: 'Kebab-case quiz slug', example: 'javascript-fundamentals' })
  slug!: string;

  @ApiProperty({
    description: 'Quiz cover image URL, or null when no cover is set',
    example: 'https://example.com/covers/js.png',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Computed popularity score (higher = more popular)', example: 87.6 })
  popularityScore!: number;

  @ApiProperty({ description: 'Cumulative attempt count for this quiz', example: 1250 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Average review rating for this quiz (0–5 scale)', example: 4.3 })
  averageRating!: number;

  @ApiProperty({ description: 'Number of users who bookmarked this quiz', example: 95 })
  bookmarkCount!: number;
}

export class CategoryAnalyticsResponseDto {
  @ApiProperty({ description: 'Category identifier', format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Science' })
  categoryName!: string;

  @ApiProperty({
    description: 'Aggregate counts and averages for the category',
    type: CategoryAnalyticsSummaryDto,
  })
  @Type(() => CategoryAnalyticsSummaryDto)
  summary!: CategoryAnalyticsSummaryDto;

  @ApiProperty({
    description: 'Top quizzes within the category, ordered by popularity score',
    type: [CategoryAnalyticsTopQuizDto],
  })
  @Type(() => CategoryAnalyticsTopQuizDto)
  topQuizzes!: CategoryAnalyticsTopQuizDto[];

  @ApiProperty({
    description: 'ISO 8601 timestamp when these analytics were last computed',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}
