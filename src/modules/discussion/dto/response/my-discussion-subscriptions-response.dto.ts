import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyDiscussionSubscriptionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
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

export class MyDiscussionSubscriptionsPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Whether another page is available', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Opaque cursor for the next page',
    nullable: true,
    example:
      'eyJzdWJzY3JpYmVkQXQiOiIyMDI2LTA2LTA4VDA5OjAwOjAwWiIsInRocmVhZElkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=',
  })
  nextCursor!: string | null;
}

export class MyDiscussionSubscriptionsResponseDto {
  @ApiProperty({
    description: 'Subscribed discussion thread items',
    type: () => [MyDiscussionSubscriptionItemResponseDto],
  })
  items!: MyDiscussionSubscriptionItemResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => MyDiscussionSubscriptionsPaginationDto,
  })
  pagination!: MyDiscussionSubscriptionsPaginationDto;
}
