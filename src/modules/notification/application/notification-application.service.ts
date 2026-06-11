import { Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { NotificationService } from '../domain/notification.service';
import { NOTIFICATION_REPOSITORY_PORT } from '../domain/ports/notification-ports';
import type { NotificationRepositoryPort } from '../domain/ports/notification-ports';
import type {
  Notification as DomainNotification,
  NotificationListParams,
  CreateNotificationParams,
  NotificationPreferencesRow,
  UpdatePreferencesParams,
} from '../domain/types/notification.types';

@Injectable()
export class NotificationApplicationService {
  constructor(
    private readonly notificationService: NotificationService,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
  ) {}

  async getNotifications(
    user: JwtPayload,
    limit: number,
    cursor?: { createdAt: string; notificationId: string } | null,
    unreadOnly?: boolean,
    includeArchived?: boolean,
  ): Promise<{ items: DomainNotification[]; unreadCount: number; hasNextPage: boolean }> {
    const params: NotificationListParams = { limit, cursor, unreadOnly, includeArchived };

    const [notifications, unreadCount] = await Promise.all([
      this.notificationService.getNotifications(user.sub, params),
      this.notificationService.getUnreadCount(user.sub),
    ]);

    const hasNextPage = notifications.length > limit;
    const items = hasNextPage ? notifications.slice(0, limit) : notifications;

    return {
      items,
      unreadCount,
      hasNextPage,
    };
  }

  async markAsRead(notificationId: string, user: JwtPayload): Promise<void> {
    await this.notificationService.markAsRead(notificationId, user.sub);
  }

  async markAsUnread(notificationId: string, user: JwtPayload): Promise<void> {
    await this.notificationService.markAsUnread(notificationId, user.sub);
  }

  async getNotificationDetail(
    notificationId: string,
    user: JwtPayload,
  ): Promise<DomainNotification> {
    return this.notificationService.getNotificationDetail(notificationId, user.sub);
  }

  async markAllAsRead(user: JwtPayload): Promise<void> {
    await this.notificationService.markAllAsRead(user.sub);
  }

  async deleteReadNotifications(user: JwtPayload): Promise<number> {
    return this.notificationService.deleteReadNotifications(user.sub);
  }

  async deleteNotification(notificationId: string, user: JwtPayload): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user.sub);
  }

  async createNotification(params: CreateNotificationParams): Promise<DomainNotification> {
    return this.notificationService.create(params);
  }

  async getUnreadCount(user: JwtPayload): Promise<number> {
    return this.notificationService.getUnreadCount(user.sub);
  }

  /**
   * Get user notification preferences.
   */
  async getPreferences(user: JwtPayload): Promise<NotificationPreferencesRow | null> {
    return this.notificationRepository.getPreferences(user.sub);
  }

  /**
   * Update user notification preferences.
   */
  async updatePreferences(
    user: JwtPayload,
    params: UpdatePreferencesParams,
  ): Promise<NotificationPreferencesRow> {
    return this.notificationRepository.upsertPreferences(user.sub, params);
  }

  /**
   * Get or create default preferences for a user.
   */
  async getOrCreatePreferences(user: JwtPayload): Promise<NotificationPreferencesRow> {
    const existing = await this.notificationRepository.getPreferences(user.sub);
    if (existing) {
      return existing;
    }
    return this.notificationRepository.upsertPreferences(user.sub, {});
  }
}
