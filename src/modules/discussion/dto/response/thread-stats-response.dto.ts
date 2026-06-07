import { ApiProperty } from '@nestjs/swagger';

export class ThreadStatsResponseDto {
  @ApiProperty({
    description: 'Thread identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Number of top-level comments', example: 12 })
  totalComments!: number;

  @ApiProperty({ description: 'Total number of replies across all comments', example: 45 })
  totalReplies!: number;

  @ApiProperty({ description: 'Number of distinct participants who commented', example: 8 })
  totalParticipants!: number;

  @ApiProperty({ description: 'Number of upvotes', example: 25 })
  upvotes!: number;

  @ApiProperty({ description: 'Number of downvotes', example: 3 })
  downvotes!: number;

  @ApiProperty({
    description: 'Timestamp of the most recent activity (comment, reply, or vote)',
    example: '2026-06-02T14:30:00.000Z',
  })
  latestActivityAt!: string;
}
