import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const THREAD_STATUS_VALUES = ['open', 'closed', 'hidden', 'deleted'] as const;

export class AuthorDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'quiz_master' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    nullable: true,
    example: 'Quiz Master',
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    nullable: true,
    example: 'https://cdn.example.com/avatar.png',
  })
  avatarUrl!: string | null;
}

export class ThreadDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Quiz identifier the thread belongs to',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Author identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
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
    type: Boolean,
    example: false,
  })
  isSolved!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the thread was marked as solved',
    type: String,
    nullable: true,
    example: null,
  })
  solvedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Selected solution comment identifier',
    type: String,
    nullable: true,
    example: null,
  })
  solvedCommentId!: string | null;

  @ApiPropertyOptional({
    description: 'User identifier who marked the thread as solved',
    type: String,
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
    type: String,
    nullable: true,
    example: null,
  })
  deletedAt!: string | null;
}
