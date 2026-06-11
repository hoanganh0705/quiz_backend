import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrendingDiscussionAuthorResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'quiz_master' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', nullable: true, example: 'Quiz Master' })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    nullable: true,
    example: 'https://cdn.example.com/avatar.png',
  })
  avatarUrl!: string | null;
}

export class TrendingDiscussionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Quiz identifier the thread belongs to',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Thread title', example: 'How is scoring calculated?' })
  title!: string;

  @ApiProperty({ description: 'Thread author', type: () => TrendingDiscussionAuthorResponseDto })
  author!: TrendingDiscussionAuthorResponseDto;

  @ApiProperty({ description: 'Number of top-level comments', example: 15 })
  commentCount!: number;

  @ApiProperty({ description: 'Total number of replies across all comments', example: 42 })
  replyCount!: number;

  @ApiProperty({ description: 'Net vote count', example: 38 })
  voteCount!: number;

  @ApiProperty({
    description: 'Timestamp of the most recent activity (comment or reply)',
    example: '2026-06-02T14:30:00.000Z',
  })
  latestActivityAt!: string;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({ description: 'Trending relevance score', example: 125.5 })
  trendingScore!: number;
}

export class TrendingDiscussionsPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJzY29yZSI6MTI1LjUsInRocmVhZElkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=',
  })
  nextCursor!: string | null;
}

export class TrendingDiscussionsResponseDto {
  @ApiProperty({
    description: 'Trending discussion thread items',
    type: () => [TrendingDiscussionItemResponseDto],
  })
  items!: TrendingDiscussionItemResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => TrendingDiscussionsPaginationResponseDto,
  })
  pagination!: TrendingDiscussionsPaginationResponseDto;
}
