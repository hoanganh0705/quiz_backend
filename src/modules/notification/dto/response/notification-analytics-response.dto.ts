import { ApiProperty } from '@nestjs/swagger';

export class NotificationAnalyticsDto {
  @ApiProperty({ description: 'Total number of notifications', example: 1248 })
  total!: number;

  @ApiProperty({ description: 'Number of unread notifications', example: 73 })
  unread!: number;

  @ApiProperty({
    description: 'Notification counts grouped by type',
    example: { achievement_earned: 450, rank_achievement: 300, discussion_reply: 498 },
  })
  byType!: Record<string, number>;

  @ApiProperty({
    description: 'Notification counts grouped by channel',
    example: { in_app: 1100, email: 148 },
  })
  byChannel!: Record<string, number>;

  @ApiProperty({ description: 'Notifications created in the last 24 hours', example: 85 })
  last24h!: number;

  @ApiProperty({ description: 'Notifications created in the last 7 days', example: 412 })
  last7d!: number;
}
