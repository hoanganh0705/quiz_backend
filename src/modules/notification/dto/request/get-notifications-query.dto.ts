import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_TYPE_VALUES } from '../../domain/types/notification.types';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of notifications to return (1-100)',
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Base64-encoded cursor for pagination. Decodes to `{ createdAt, notificationId }`.',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Filter to unread notifications only',
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === 'true';
    }
    return false;
  })
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Include archived (soft-deleted) notifications',
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === 'true';
    }
    return false;
  })
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: 'Filter notifications by type',
    enum: NOTIFICATION_TYPE_VALUES,
    isArray: false,
  })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPE_VALUES)
  type?: string;
}
