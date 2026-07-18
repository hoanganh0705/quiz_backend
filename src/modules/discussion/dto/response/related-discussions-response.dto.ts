import { ApiProperty } from '@nestjs/swagger';

export class RelatedDiscussionItemResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({
    description: 'Discussion thread title',
    example: 'How does ranking XP work?',
  })
  title!: string;

  @ApiProperty({ description: 'Number of comments on the thread', example: 15 })
  commentCount!: number;

  @ApiProperty({ description: 'Net vote count on the thread', example: 24 })
  voteCount!: number;
}

export class RelatedDiscussionsResponseDto {
  @ApiProperty({
    description: 'Related discussion thread items ordered by relevance',
    type: () => [RelatedDiscussionItemResponseDto],
  })
  items!: RelatedDiscussionItemResponseDto[];
}
