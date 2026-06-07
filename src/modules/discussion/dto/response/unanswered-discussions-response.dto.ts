import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnansweredDiscussionAuthorResponseDto {
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

export class UnansweredDiscussionItemResponseDto {
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

  @ApiProperty({ description: 'Thread author', type: () => UnansweredDiscussionAuthorResponseDto })
  author!: UnansweredDiscussionAuthorResponseDto;

  @ApiProperty({ description: 'Number of comments (always 0)', example: 0 })
  commentCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00.000Z',
  })
  updatedAt!: string;
}

export class UnansweredDiscussionsPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJ0aHJlYWRJZCI6IjY2MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class UnansweredDiscussionsResponseDto {
  @ApiProperty({
    description: 'Unanswered discussion thread items',
    type: () => [UnansweredDiscussionItemResponseDto],
  })
  items!: UnansweredDiscussionItemResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => UnansweredDiscussionsPaginationResponseDto })
  pagination!: UnansweredDiscussionsPaginationResponseDto;
}
