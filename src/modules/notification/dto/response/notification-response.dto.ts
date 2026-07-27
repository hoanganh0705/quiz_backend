import { Expose } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_CHANNEL_VALUES,
} from '../../domain/types/notification.types';

export type NotificationTypeValue = (typeof NOTIFICATION_TYPE_VALUES)[number];
export type NotificationChannelValue = (typeof NOTIFICATION_CHANNEL_VALUES)[number];

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Unique notification identifier',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  @Expose()
  @IsUUID('7')
  notificationId!: string;

  @ApiProperty({
    description: 'Recipient user identifier',
    type: String,
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  @Expose()
  @IsUUID('7')
  userId!: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NOTIFICATION_TYPE_VALUES,
    example: 'achievement_earned',
  })
  @Expose()
  @IsIn(NOTIFICATION_TYPE_VALUES)
  type!: NotificationTypeValue;

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
    type: Object,
    example: { badgeType: 'js_master', achievementType: 'mastery' },
  })
  @Expose()
  @IsObject()
  metadata!: Record<string, unknown>;

  @ApiProperty({
    description: 'Delivery channel',
    enum: Object.values(NOTIFICATION_CHANNEL_VALUES),
    example: 'in_app',
  })
  @Expose()
  @IsIn(NOTIFICATION_CHANNEL_VALUES)
  channel!: NotificationChannelValue;

  @ApiProperty({
    description: 'Whether the user has read this notification',
    example: false,
  })
  @Expose()
  @IsBoolean()
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when the notification was read (ISO 8601, null if unread)',
    type: String,
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

  @ApiPropertyOptional({
    description:
      'Notification expiration timestamp (ISO 8601). Null means the notification never expires.',
    type: String,
    example: '2025-07-01T10:00:00.000Z',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsISO8601()
  expiresAt!: string | null;
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
    description: 'Whether comment reply and mention notifications are enabled',
    example: true,
  })
  @Expose()
  @IsBoolean()
  commentEnabled!: boolean;

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
    type: String,
    example: '22:00',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  quietHoursStart!: string | null;

  @ApiPropertyOptional({
    description: 'Quiet hours end time in HH:MM format — notifications resume after this time',
    type: String,
    example: '08:00',
    nullable: true,
  })
  @Expose()
  @IsOptional()
  @IsString()
  quietHoursEnd!: string | null;
}
