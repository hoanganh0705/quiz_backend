import { ApiProperty } from '@nestjs/swagger';

export class AchievementHistoryItemResponseDto {
  @ApiProperty({ description: 'Badge identifier', example: 'top_100' })
  badgeId!: string;

  @ApiProperty({ description: 'Badge display name', example: 'Top 100' })
  badgeName!: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the badge was earned',
    example: '2026-06-01T10:00:00Z',
  })
  earnedAt!: string;
}
