import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
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
    description:
      'Filter notifications by type. Currently only single-type filtering is supported. ' +
      'Multi-type filtering (e.g., `?type=ACHIEVEMENT&type=FRIEND_REQUEST`) may be added in a future API version.',
    enum: NOTIFICATION_TYPE_VALUES,
    isArray: false,
  })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPE_VALUES)
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter notifications created after this ISO 8601 date',
    example: '2026-01-01T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter notifications created before this ISO 8601 date',
    example: '2026-12-31T23:59:59.999Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
