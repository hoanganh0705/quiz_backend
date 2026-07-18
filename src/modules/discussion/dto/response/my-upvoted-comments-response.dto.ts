import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyUpvotedCommentItemResponseDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Thread identifier the comment belongs to',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Comment content',
    example: 'I think the XP depends on response speed.',
  })
  content!: string;

  @ApiProperty({ description: 'Net vote count on the comment', example: 12 })
  voteCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the authenticated user upvoted the comment',
    example: '2026-06-08T09:00:00Z',
  })
  upvotedAt!: string;
}

export class MyUpvotedCommentsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJ1cHVvdGVkQXQiOiIyMDI2LTA2LTA4VDA5OjAwOjAwWiIsImNvbW1lbnRJZCI6Ijg4MGU4NDgwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9',
  })
  nextCursor!: string | null;
}

export class MyUpvotedCommentsResponseDto {
  @ApiProperty({
    description: 'Upvoted comment items',
    type: () => [MyUpvotedCommentItemResponseDto],
  })
  items!: MyUpvotedCommentItemResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => MyUpvotedCommentsPaginationDto })
  pagination!: MyUpvotedCommentsPaginationDto;
}
