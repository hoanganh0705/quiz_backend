import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { NotificationService } from '../domain/notification.service';
import type { Notification, NotificationListParams, CreateNotificationParams } from '../domain/types/notification.types';

@Injectable()
export class NotificationApplicationService {
  constructor(private readonly notificationService: NotificationService) {}

  async getNotifications(
    user: JwtPayload,
    limit: number,
    cursor?: { createdAt: string; notificationId: string } | null,
    unreadOnly?: boolean,
  ): Promise<{ items: Notification[]; unreadCount: number; hasNextPage: boolean }> {
    const params: NotificationListParams = { limit, cursor, unreadOnly };

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

  async markAllAsRead(user: JwtPayload): Promise<void> {
    await this.notificationService.markAllAsRead(user.sub);
  }

  async deleteNotification(notificationId: string, user: JwtPayload): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user.sub);
  }

  async createNotification(params: CreateNotificationParams): Promise<Notification> {
    return this.notificationService.create(params);
  }

  async getUnreadCount(user: JwtPayload): Promise<number> {
    return this.notificationService.getUnreadCount(user.sub);
  }
}
