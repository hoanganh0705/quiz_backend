import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyDiscussionStatsResponseDto {
  @ApiProperty({ description: 'Number of discussion threads created by the user', example: 15 })
  totalThreadsCreated!: number;

  @ApiProperty({ description: 'Number of top-level comments created by the user', example: 42 })
  totalCommentsCreated!: number;

  @ApiProperty({ description: 'Total number of replies created by the user', example: 28 })
  totalRepliesCreated!: number;

  @ApiProperty({
    description: 'Total discussion contributions (threads + comments)',
    example: 57,
  })
  totalDiscussionContributions!: number;

  @ApiProperty({ description: 'Total votes received on threads created by the user', example: 85 })
  totalReceivedVotes!: number;

  @ApiPropertyOptional({
    description: 'Timestamp of the most recent discussion activity by the user',
    nullable: true,
    example: '2026-06-02T14:30:00.000Z',
  })
  latestDiscussionActivityAt!: string | null;
}
