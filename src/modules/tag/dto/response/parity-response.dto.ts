import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CursorPagination } from '@/common/responses/pagination';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';

export class TagQuizzesResponseDto extends QuizListResponseDto {}

export class RankedTagResponseDto {
  @ApiProperty({ description: '1-based rank position' })
  rank!: number;

  @ApiProperty({ description: 'Tag identifier', format: 'uuid' })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'JavaScript' })
  name!: string;

  @ApiProperty({ description: 'Kebab-case tag slug', example: 'javascript' })
  slug!: string;

  @ApiProperty({ description: 'Aggregated popularity or trending score (numeric string)' })
  totalScore!: string;

  @ApiProperty({ description: 'Total quiz attempts across linked active quizzes (numeric string)' })
  totalAttempts!: string;

  @ApiProperty({ description: 'Tag creation timestamp (ISO 8601)' })
  createdAt!: string;

  @ApiProperty({ description: 'Tag last update timestamp (ISO 8601)' })
  updatedAt!: string;
}

export class FollowedTagItemDto {
  @ApiProperty({ description: 'Tag identifier', format: 'uuid' })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'JavaScript' })
  name!: string;

  @ApiProperty({ description: 'Kebab-case tag slug', example: 'javascript' })
  slug!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user followed this tag',
    example: '2025-06-01T12:00:00.000Z',
    required: true,
  })
  followedAt!: string;
}

export class FollowedTagsResponseDto {
  @ApiProperty({
    description: 'Tags the authenticated user follows, ordered by most recently followed',
    type: [FollowedTagItemDto],
  })
  items!: FollowedTagItemDto[];

  @ApiProperty({ description: 'Cursor pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}

export class TagAnalyticsSummaryDto {
  @ApiProperty({ description: 'Total quizzes carrying the tag (any status)', example: 12 })
  totalQuizzes!: number;

  @ApiProperty({ description: 'Number of currently active quizzes carrying the tag', example: 10 })
  activeQuizzes!: number;

  @ApiProperty({
    description: 'Cumulative attempt count across all active quizzes carrying the tag',
    example: 2480,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of distinct users who attempted any quiz carrying the tag',
    example: 920,
  })
  uniquePlayers!: number;

  @ApiProperty({
    description: 'Average score percent across attempts in tagged quizzes',
    example: 78.4,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Average review rating across tagged quizzes (0–5 scale)',
    example: 4.6,
  })
  averageRating!: number;
}

export class TagAnalyticsTopQuizDto {
  @ApiProperty({
    description: '1-based rank within the tag, sorted by popularity score',
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
    description: 'Quiz cover image URL',
    type: String,
    nullable: true,
    example: 'https://example.com/covers/js.png',
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

export class TagAnalyticsResponseDto {
  @ApiProperty({ description: 'Tag identifier', format: 'uuid' })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'JavaScript' })
  tagName!: string;

  @ApiProperty({
    description: 'Aggregate counts and averages for the tag',
    type: TagAnalyticsSummaryDto,
  })
  @Type(() => TagAnalyticsSummaryDto)
  summary!: TagAnalyticsSummaryDto;

  @ApiProperty({
    description: 'Top quizzes carrying the tag, ordered by popularity score',
    type: [TagAnalyticsTopQuizDto],
  })
  @Type(() => TagAnalyticsTopQuizDto)
  topQuizzes!: TagAnalyticsTopQuizDto[];

  @ApiProperty({
    description: 'ISO 8601 timestamp when these analytics were last computed',
    example: '2026-06-05T01:00:00.000Z',
  })
  lastUpdated!: string;
}
