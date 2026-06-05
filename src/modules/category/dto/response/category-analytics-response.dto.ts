import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CategoryAnalyticsSummaryDto {
  @ApiProperty({ example: 12 })
  totalQuizzes!: number;

  @ApiProperty({ example: 10 })
  activeQuizzes!: number;

  @ApiProperty({ example: 2480 })
  totalAttempts!: number;

  @ApiProperty({ example: 920 })
  totalPlayers!: number;

  @ApiProperty({ example: 78.4 })
  averageScore!: number;

  @ApiProperty({ example: 4.6 })
  averageRating!: number;
}

export class CategoryAnalyticsTopQuizDto {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ format: 'uuid' })
  quizId!: string;

  @ApiProperty({ example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ example: 'javascript-fundamentals' })
  slug!: string;

  @ApiProperty({ example: 'https://example.com/covers/js.png', nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: 87.6 })
  popularityScore!: number;

  @ApiProperty({ example: 1250 })
  totalAttempts!: number;

  @ApiProperty({ example: 4.3 })
  averageRating!: number;

  @ApiProperty({ example: 95 })
  bookmarkCount!: number;
}

export class CategoryAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ example: 'Science' })
  categoryName!: string;

  @ApiProperty({ type: CategoryAnalyticsSummaryDto })
  @Type(() => CategoryAnalyticsSummaryDto)
  summary!: CategoryAnalyticsSummaryDto;

  @ApiProperty({ type: [CategoryAnalyticsTopQuizDto] })
  @Type(() => CategoryAnalyticsTopQuizDto)
  topQuizzes!: CategoryAnalyticsTopQuizDto[];

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
