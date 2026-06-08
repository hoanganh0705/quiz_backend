import { ApiProperty } from '@nestjs/swagger';

export class MyUpvotedCommentItemResponseDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '880e8400-e29b-41d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Thread identifier the comment belongs to',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Comment content', example: 'I think the XP depends on response speed.' })
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

export class MyUpvotedCommentsResponseDto {
  @ApiProperty({ description: 'Upvoted comment items', type: () => [MyUpvotedCommentItemResponseDto] })
  items!: MyUpvotedCommentItemResponseDto[];

  @ApiProperty({ description: 'Total number of matching comments', example: 50 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}
