import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { NotificationResponseDto } from '../../dto/response/notification-response.dto';
import type { UnreadCountResponseDto } from '../../dto/response/unread-count-response.dto';
import type { NotificationAnalyticsDto } from '../../dto/response/notification-analytics-response.dto';
import type { DeletedReadNotificationsResponseDto } from '../../dto/response/deleted-read-notifications-response.dto';
import type { NotificationPreferencesResponseDto } from '../../dto/response/notification-response.dto';

/**
 * Presenter for the notification module. Wraps every application-service
 * response in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated. Endpoints that
 * return 204 No Content (mark-as-read, mark-as-unread, mark-all-as-read,
 * delete-notification) bypass the presenter entirely.
 *
 * The list endpoint (`getNotifications`) is a D-variant that the application
 * service re-shaped into `PaginatedResult<NotificationResponseDto>` (the cursor
 * is a base64-encoded `{createdAt, notificationId}` pair, matching the
 * pre-migration request format). The presenter's `getNotifications` unpacks
 * the result and hands it to `ApiResponse.page` so the cursor goes verbatim
 * into `meta.pagination`.
 */
@Injectable()
export class NotificationPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // List endpoint — `PaginatedResult` already in the standard cursor format.
  readonly getNotifications = (payload: PaginatedResult<NotificationResponseDto>) =>
    ApiResponse.page(payload.items, payload.pagination);

  // Single-resource endpoints.
  readonly getUnreadCount = NotificationPresenter.ok<UnreadCountResponseDto>;
  readonly getAnalytics = NotificationPresenter.ok<NotificationAnalyticsDto>;
  readonly getPreferences = NotificationPresenter.ok<NotificationPreferencesResponseDto>;
  readonly updatePreferences = NotificationPresenter.ok<NotificationPreferencesResponseDto>;
  readonly getNotificationDetail = NotificationPresenter.ok<NotificationResponseDto>;
  readonly deleteReadNotifications = NotificationPresenter.ok<DeletedReadNotificationsResponseDto>;
}
