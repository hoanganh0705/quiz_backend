import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { NotificationResponseDto } from '../../dto/response/notification-response.dto';
import type { UnreadCountResponseDto } from '../../dto/response/unread-count-response.dto';
import type { NotificationAnalyticsDto } from '../../dto/response/notification-analytics-response.dto';
import type { NotificationPreferencesResponseDto } from '../../dto/response/notification-response.dto';

@Injectable()
export class NotificationPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly getNotifications = (payload: PaginatedResult<NotificationResponseDto>) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly getUnreadCount = NotificationPresenter.ok<UnreadCountResponseDto>;
  readonly getAnalytics = NotificationPresenter.ok<NotificationAnalyticsDto>;
  readonly getPreferences = NotificationPresenter.ok<NotificationPreferencesResponseDto>;
  readonly updatePreferences = NotificationPresenter.ok<NotificationPreferencesResponseDto>;
  readonly getNotificationDetail = NotificationPresenter.ok<NotificationResponseDto>;
}
