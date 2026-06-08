import { ApiProperty } from '@nestjs/swagger';

export class MyDiscussionSubscriptionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Discussion thread title', example: 'How does ranking XP work?' })
  title!: string;

  @ApiProperty({ description: 'Number of comments on the thread', example: 18 })
  commentCount!: number;

  @ApiProperty({ description: 'Net vote count on the thread', example: 22 })
  voteCount!: number;

  @ApiProperty({
    description: 'Timestamp when the authenticated user subscribed to the thread',
    example: '2026-06-08T09:00:00Z',
  })
  subscribedAt!: string;
}

export class MyDiscussionSubscriptionsResponseDto {
  @ApiProperty({
    description: 'Subscribed discussion thread items',
    type: () => [MyDiscussionSubscriptionItemResponseDto],
  })
  items!: MyDiscussionSubscriptionItemResponseDto[];

  @ApiProperty({ description: 'Total number of matching subscriptions', example: 8 })
  total!: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;
}
