import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthorDto } from './thread-response.dto';

const CONTENT_STATUS_VALUES = ['visible', 'hidden', 'deleted'] as const;
const VOTE_VALUES = ['upvote', 'downvote'] as const;

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
    type: String,
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
    type: String,
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
    type: String,
    nullable: true,
    example: 'upvote',
  })
  userVote!: (typeof VOTE_VALUES)[number] | null;
}

export class ThreadDetailDto extends CommentDto {
  @ApiPropertyOptional({
    description: 'Authenticated user vote on this thread',
    enum: VOTE_VALUES,
    type: String,
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
