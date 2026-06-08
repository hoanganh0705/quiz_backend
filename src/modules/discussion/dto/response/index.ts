import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export * from './quiz-discussion-list-response.dto';
export * from './my-discussions-response.dto';
export * from './my-comments-response.dto';
export * from './my-upvoted-threads-response.dto';
export * from './my-upvoted-comments-response.dto';
export * from './my-discussion-subscriptions-response.dto';
export * from './my-saved-threads-response.dto';
export * from './discussion-subscription-action-response.dto';
export * from './discussion-saved-thread-action-response.dto';
export * from './discussion-thread-solve-response.dto';
export * from './trending-discussions-response.dto';
export * from './unanswered-discussions-response.dto';
export * from './search-discussions-response.dto';
export * from './related-discussions-response.dto';
export * from './thread-participants-response.dto';
export * from './public-discussion-profile-response.dto';
export * from './thread-stats-response.dto';
export * from './my-discussion-stats-response.dto';

const THREAD_STATUS_VALUES = ['open', 'closed', 'hidden', 'deleted'] as const;
const CONTENT_STATUS_VALUES = ['visible', 'hidden', 'deleted', 'accepted'] as const;
const VOTE_VALUES = ['upvote', 'downvote'] as const;
const REPORT_STATUS_VALUES = ['open', 'reviewed', 'dismissed', 'actioned'] as const;
const REPORT_TARGET_TYPE_VALUES = ['thread', 'comment', 'reply'] as const;

export class AuthorDto {
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

export class ThreadDto {
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

  @ApiProperty({
    description: 'Author identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  authorId!: string;

  @ApiProperty({ description: 'Thread author', type: () => AuthorDto })
  author!: AuthorDto;

  @ApiProperty({ description: 'Thread title', example: 'How is scoring calculated?' })
  title!: string;

  @ApiProperty({
    description: 'Thread body content',
    example: 'I noticed score multipliers in round two. How do they work?',
  })
  body!: string;

  @ApiProperty({
    description: 'Thread moderation/status state',
    enum: THREAD_STATUS_VALUES,
    example: 'open',
  })
  status!: (typeof THREAD_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description: 'Whether the thread has been marked as solved',
    example: false,
  })
  isSolved!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the thread was marked as solved',
    nullable: true,
    example: null,
  })
  solvedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Selected solution comment identifier',
    nullable: true,
    example: null,
  })
  solvedCommentId!: string | null;

  @ApiPropertyOptional({
    description: 'User identifier who marked the thread as solved',
    nullable: true,
    example: null,
  })
  solvedBy!: string | null;

  @ApiProperty({ description: 'Total comment count', example: 12 })
  commentsCount!: number;

  @ApiProperty({ description: 'Net vote count', example: 8 })
  votesCount!: number;

  @ApiProperty({ description: 'Upvote count', example: 10 })
  upvotesCount!: number;

  @ApiProperty({ description: 'Downvote count', example: 2 })
  downvotesCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T11:00:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Soft deletion timestamp in ISO 8601 format',
    nullable: true,
    example: null,
  })
  deletedAt!: string | null;
}

export class CommentDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Parent thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Author identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  authorId!: string;

  @ApiProperty({ description: 'Comment author', type: () => AuthorDto })
  author!: AuthorDto;

  @ApiPropertyOptional({
    description: 'Parent comment identifier when this is a reply',
    nullable: true,
    example: null,
  })
  parentCommentId!: string | null;

  @ApiProperty({ description: 'Comment body', example: 'I think it is based on response speed.' })
  body!: string;

  @ApiProperty({
    description: 'Comment moderation/status state',
    enum: CONTENT_STATUS_VALUES,
    example: 'visible',
  })
  status!: (typeof CONTENT_STATUS_VALUES)[number];

  @ApiProperty({ description: 'Number of direct replies', example: 3 })
  repliesCount!: number;

  @ApiProperty({ description: 'Net vote count', example: 5 })
  votesCount!: number;

  @ApiProperty({ description: 'Upvote count', example: 6 })
  upvotesCount!: number;

  @ApiProperty({ description: 'Downvote count', example: 1 })
  downvotesCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T10:35:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T10:45:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Soft deletion timestamp in ISO 8601 format',
    nullable: true,
    example: null,
  })
  deletedAt!: string | null;
}

export class CommentWithRepliesDto extends CommentDto {
  @ApiProperty({ description: 'Nested replies', type: () => [CommentDto] })
  replies!: CommentDto[];

  @ApiPropertyOptional({
    description: 'Authenticated user vote on this comment',
    enum: VOTE_VALUES,
    nullable: true,
    example: 'upvote',
  })
  userVote!: (typeof VOTE_VALUES)[number] | null;
}

export class ThreadDetailDto extends ThreadDto {
  @ApiPropertyOptional({
    description: 'Authenticated user vote on this thread',
    enum: VOTE_VALUES,
    nullable: true,
    example: null,
  })
  userVote!: (typeof VOTE_VALUES)[number] | null;

  @ApiProperty({
    description: 'Top-level comments with nested replies',
    type: () => [CommentWithRepliesDto],
  })
  comments!: CommentWithRepliesDto[];
}

export class PaginatedThreadsDto {
  @ApiProperty({ description: 'Thread page items', type: () => [ThreadDto] })
  items!: ThreadDto[];

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;
}

export class PaginatedCommentsDto {
  @ApiProperty({ description: 'Comment page items', type: () => [CommentWithRepliesDto] })
  items!: CommentWithRepliesDto[];

  @ApiProperty({ description: 'Whether another page is available', example: false })
  hasNextPage!: boolean;
}

export class ReportDto {
  @ApiProperty({
    description: 'Report identifier',
    example: '990e8400-e29b-41d4-a716-446655440000',
  })
  reportId!: string;

  @ApiProperty({
    description: 'Reporting user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  reporterId!: string;

  @ApiProperty({
    description: 'Type of content being reported',
    enum: REPORT_TARGET_TYPE_VALUES,
    example: 'comment',
  })
  targetType!: (typeof REPORT_TARGET_TYPE_VALUES)[number];

  @ApiProperty({
    description: 'Identifier of the reported target',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  targetId!: string;

  @ApiProperty({ description: 'Short report reason', example: 'Harassment' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional additional moderator context',
    nullable: true,
    example: 'Contains repeated personal attacks.',
  })
  details!: string | null;

  @ApiProperty({
    description: 'Current moderation status',
    enum: REPORT_STATUS_VALUES,
    example: 'open',
  })
  status!: (typeof REPORT_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    description: 'Moderator who reviewed the report',
    nullable: true,
    example: null,
  })
  reviewedByUserId!: string | null;

  @ApiPropertyOptional({
    description: 'When the report was reviewed',
    nullable: true,
    example: null,
  })
  reviewedAt!: string | null;

  @ApiProperty({
    description: 'Whether moderation action was taken on the content',
    example: false,
  })
  actionTaken!: boolean;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-02T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-02T12:10:00.000Z',
  })
  updatedAt!: string;
}

export class PaginatedReportsDto {
  @ApiProperty({ description: 'Report page items', type: () => [ReportDto] })
  items!: ReportDto[];

  @ApiProperty({ description: 'Whether another page is available', example: false })
  hasNextPage!: boolean;
}
