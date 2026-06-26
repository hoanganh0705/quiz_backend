import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/swagger/swagger-schemas';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  NotificationPreferencesResponseDto,
} from './notification-response.dto';
import { UnreadCountResponseDto } from './unread-count-response.dto';
import { DeletedReadNotificationsResponseDto } from './deleted-read-notifications-response.dto';
import { NotificationAnalyticsDto } from './notification-analytics-response.dto';

// ─── Notification module documentation-only wrapper DTOs ─────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated payloads ({ items, pagination }), the interceptor extracts
// the items as data and nests pagination inside meta:
//   { data: items, meta: { timestamp, pagination } }
//
// NotificationListResponseDto has { items, unreadCount, hasNextPage }.
// Since 'pagination' key is absent, the interceptor does NOT treat it as
// cursor-paginated — it wraps as { data: NotificationListResponseDto, meta: { timestamp } }.
//
// Runtime DTOs live in their own response DTO files and are imported here for
// use in wrapper type refs.
//
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Paginated meta ─────────────────────────────────────────────────────────────

class NotificationListMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Notification list cursor-pagination metadata' })
  pagination!: PaginationMetaDto;
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedNotificationListResponseDto {
  @ApiProperty({
    description: 'Notification list data',
    type: () => NotificationListResponseDto,
  })
  data!: NotificationListResponseDto;

  @ApiProperty({ description: 'Response metadata', type: NotificationListMetaDto })
  meta!: NotificationListMetaDto;
}

export class WrappedNotificationResponseDto {
  @ApiProperty({
    description: 'Notification detail data',
    type: () => NotificationResponseDto,
  })
  data!: NotificationResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedNotificationPreferencesResponseDto {
  @ApiProperty({
    description: 'User notification preferences',
    type: () => NotificationPreferencesResponseDto,
  })
  data!: NotificationPreferencesResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedUnreadCountResponseDto {
  @ApiProperty({
    description: 'Unread notification count',
    type: () => UnreadCountResponseDto,
  })
  data!: UnreadCountResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedDeletedReadNotificationsResponseDto {
  @ApiProperty({
    description: 'Deletion result',
    type: () => DeletedReadNotificationsResponseDto,
  })
  data!: DeletedReadNotificationsResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedNotificationAnalyticsDto {
  @ApiProperty({
    description: 'Notification analytics data',
    type: () => NotificationAnalyticsDto,
  })
  data!: NotificationAnalyticsDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}
