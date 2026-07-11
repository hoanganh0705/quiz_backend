import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';

export class TagQuizzesResponseDto extends QuizListResponseDto {}

export class RankedTagResponseDto {
  @ApiProperty({ description: '1-based rank position' })
  rank!: number;

  @ApiProperty()
  tagId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ description: 'Aggregated popularity or trending score (numeric string)' })
  totalScore!: string;

  @ApiProperty({ description: 'Total quiz attempts across linked active quizzes (numeric string)' })
  totalAttempts!: string;
}

export class TagFollowMessageResponseDto {
  @ApiProperty({ example: 'Tag followed successfully' })
  message!: string;

  @ApiProperty({ example: true, description: 'Whether the requested follow state changed.' })
  changed!: boolean;
}

export class FollowedTagItemDto {
  @ApiProperty()
  tagId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp when the user followed this tag',
    type: String,
  })
  followedAt!: string;
}

class FollowedTagsPaginationDto {
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

export class FollowedTagsResponseDto {
  @ApiProperty({ type: [FollowedTagItemDto] })
  items!: FollowedTagItemDto[];

  @ApiProperty({ type: FollowedTagsPaginationDto })
  pagination!: FollowedTagsPaginationDto;
}

export class TagAnalyticsSummaryDto {
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

export class TagAnalyticsTopQuizDto {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ format: 'uuid' })
  quizId!: string;

  @ApiProperty({ example: 'JavaScript Fundamentals' })
  title!: string;

  @ApiProperty({ example: 'javascript-fundamentals' })
  slug!: string;

  @ApiProperty({
    description: 'Quiz cover image URL',
    type: String,
    nullable: true,
    example: 'https://example.com/covers/js.png',
  })
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

export class TagAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  tagId!: string;

  @ApiProperty({ example: 'JavaScript' })
  tagName!: string;

  @ApiProperty({ type: TagAnalyticsSummaryDto })
  @Type(() => TagAnalyticsSummaryDto)
  summary!: TagAnalyticsSummaryDto;

  @ApiProperty({ type: [TagAnalyticsTopQuizDto] })
  @Type(() => TagAnalyticsTopQuizDto)
  topQuizzes!: TagAnalyticsTopQuizDto[];

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
