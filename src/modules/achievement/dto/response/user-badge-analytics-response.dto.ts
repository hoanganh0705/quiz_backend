import { ApiProperty } from '@nestjs/swagger';

export class UserBadgeAnalyticsResponseDto {
  @ApiProperty({ description: 'Total earned badges for the authenticated user', example: 15 })
  totalBadges!: number;

  @ApiProperty({ description: 'Number of rare-or-better badges earned', example: 2 })
  rareBadges!: number;

  @ApiProperty({ description: 'Completion rate percentage clamped between 0 and 100', example: 32 })
  completionRate!: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the most recently earned badge',
    type: 'string',
    nullable: true,
    example: '2026-06-01T10:00:00Z',
  })
  latestBadgeEarnedAt!: string | null;
}
