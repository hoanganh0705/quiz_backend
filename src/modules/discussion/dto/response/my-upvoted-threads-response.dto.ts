import { ApiProperty } from '@nestjs/swagger';

export class MyUpvotedThreadItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Thread title', example: 'How does ranking XP work?' })
  title!: string;

  @ApiProperty({ description: 'Net vote count on the thread', example: 25 })
  voteCount!: number;

  @ApiProperty({ description: 'Number of comments on the thread', example: 12 })
  commentCount!: number;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2026-06-01T10:00:00Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the authenticated user upvoted the thread',
    example: '2026-06-08T09:00:00Z',
  })
  upvotedAt!: string;
}

export class MyUpvotedThreadsResponseDto {
  @ApiProperty({ description: 'Upvoted thread items', type: () => [MyUpvotedThreadItemResponseDto] })
  items!: MyUpvotedThreadItemResponseDto[];

  @ApiProperty({ description: 'Total number of matching threads', example: 25 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}
