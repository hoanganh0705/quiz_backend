import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TagResponseDto } from './tag-response.dto';

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

export class RankedTagsResponseDto {
  @ApiProperty({ type: [RankedTagResponseDto] })
  items!: RankedTagResponseDto[];
}

export class RelatedTagsResponseDto {
  @ApiProperty({ type: [TagResponseDto], description: 'Related tag items' })
  items!: TagResponseDto[];
}

export class TagFollowMessageResponseDto {
  @ApiProperty({ example: 'Tag followed successfully' })
  message!: string;
}

export class FollowedTagItemDto {
  @ApiProperty()
  tagId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp when the user followed this tag' })
  followedAt!: string;
}

class FollowedTagsPaginationDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiPropertyOptional({ nullable: true })
  nextCursor!: string | null;
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

export class TagAnalyticsResponseDto {
  @ApiProperty({ format: 'uuid' })
  tagId!: string;

  @ApiProperty({ example: 'Science' })
  tagName!: string;

  @ApiProperty({ type: TagAnalyticsSummaryDto })
  summary!: TagAnalyticsSummaryDto;

  @ApiProperty({ type: [TagAnalyticsTopQuizDto] })
  topQuizzes!: TagAnalyticsTopQuizDto[];

  @ApiProperty({ example: '2026-06-05T01:00:00.000Z' })
  lastUpdated!: string;
}
