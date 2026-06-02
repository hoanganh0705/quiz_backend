import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../ports/notification-ports';
import type { Notification, CreateNotificationParams, NotificationListParams } from '../types/notification.types';
import { NotificationNotFoundError, NotificationForbiddenError } from '../errors/notification.errors';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(params: CreateNotificationParams): Promise<Notification> {
    const notification = await this.notificationRepository.create(params);

    this.logger.info({
      event: 'notification_created',
      notificationId: notification.notificationId,
      userId: params.userId,
      type: params.type,
    });

    return notification;
  }

  async getNotifications(
    userId: string,
    params: NotificationListParams,
  ): Promise<Notification[]> {
    return this.notificationRepository.findByUser({ ...params, limit: params.limit });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.userId !== userId) {
      throw new NotificationForbiddenError();
    }

    await this.notificationRepository.markAsRead(notificationId, userId);

    this.logger.info({
      event: 'notification_marked_read',
      notificationId,
      userId,
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);

    this.logger.info({
      event: 'all_notifications_marked_read',
      userId,
    });
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (notification.userId !== userId) {
      throw new NotificationForbiddenError();
    }

    await this.notificationRepository.delete(notificationId, userId);

    this.logger.info({
      event: 'notification_deleted',
      notificationId,
      userId,
    });
  }
}
