import { Expose, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const NOTIFICATION_TYPES = [
  'achievement_earned',
  'badge_unlocked',
  'rank_achievement',
  'rank_improvement',
  'period_winner',
  'tournament_invite',
  'tournament_starting',
  'tournament_completed',
  'tournament_won',
  'streak_milestone',
  'friend_request',
  'friend_accepted',
  'quiz_review_received',
  'weekly_summary',
  'system_announcement',
] as const;

const NOTIFICATION_CHANNELS = ['in_app', 'email', 'push'] as const;

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique notification identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  notificationId!: string;

  @ApiProperty({
    description: 'Recipient user identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @Expose()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NOTIFICATION_TYPES,
    example: 'achievement_earned',
  })
  @Expose()
  @IsIn(NOTIFICATION_TYPES)
  type!: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Achievement Unlocked!',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: 'Notification body message',
    example: 'You earned the "JavaScript Master" badge!',
  })
  @Expose()
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    description: 'Arbitrary metadata associated with the notification',
    example: { badgeType: 'js_master', achievementType: 'mastery' },
    additionalProperties: true,
  })
  @Expose()
  @IsObject()
  metadata!: Record<string, unknown>;

  @ApiProperty({
    description: 'Delivery channel',
    enum: NOTIFICATION_CHANNELS,
    example: 'in_app',
  })
  @Expose()
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: string;

  @ApiProperty({
    description: 'Whether the user has read this notification',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the notification was read (ISO 8601, null if unread)',
    example: '2025-06-01T12:00:00.000Z',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsISO8601()
  readAt!: string | null;

  @ApiProperty({
    description: 'Notification creation timestamp (ISO 8601)',
    example: '2025-06-01T10:00:00.000Z',
  })
  @Expose()
  @IsISO8601()
  createdAt!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({
    description: 'Notification items for the current page',
    type: () => [NotificationResponseDto],
  })
  @Expose()
  @ValidateNested({ each: true })
  @Type(() => NotificationResponseDto)
  items!: NotificationResponseDto[];

  @ApiProperty({
    description: 'Total number of unread notifications for the user',
    example: 5,
  })
  @Expose()
  @IsInt()
  unreadCount!: number;

  @ApiProperty({
    description: 'Whether more notifications exist beyond this page',
    example: true,
  })
  @Expose()
  @IsBoolean()
  hasNextPage!: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    description: 'Whether in-app notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  inAppEnabled!: boolean;

  @ApiProperty({
    description: 'Whether email notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  emailEnabled!: boolean;

  @ApiProperty({
    description: 'Whether push notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  pushEnabled!: boolean;

  @ApiProperty({
    description: 'Whether achievement notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  achievementEnabled!: boolean;

  @ApiProperty({
    description: 'Whether tournament notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  tournamentEnabled!: boolean;

  @ApiProperty({
    description: 'Whether rank change notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  rankEnabled!: boolean;

  @ApiProperty({
    description: 'Whether friend activity notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  friendEnabled!: boolean;

  @ApiProperty({
    description: 'Whether weekly summary notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  summaryEnabled!: boolean;

  @ApiProperty({
    description: 'Whether marketing and promotional notifications are enabled',
    example: false,
  })
  @Expose()
  @IsBoolean()
  marketingEnabled!: boolean;

  @ApiProperty({
    description:
      'Minimum rank improvement (number of positions) required to trigger a rank notification',
    minimum: 1,
    maximum: 100,
    example: 5,
  })
  @Expose()
  @IsNumber()
  rankImprovementThreshold!: number;

  @ApiPropertyOptional({
    description:
      'Quiet hours start time in HH:MM format — notifications are suppressed after this time',
    example: '22:00',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  quietHoursStart!: string | null;

  @ApiPropertyOptional({
    description: 'Quiet hours end time in HH:MM format — notifications resume after this time',
    example: '08:00',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  quietHoursEnd!: string | null;
}
