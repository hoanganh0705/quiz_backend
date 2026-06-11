import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from './ports';
import type { CreateNotificationParams, NotificationListParams } from './types';
import type { Notification as DomainNotification } from './types';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getNotifications(
    userId: string,
    params: NotificationListParams,
  ): Promise<DomainNotification[]> {
    return this.notificationRepository.findByUser({ ...params, userId, limit: params.limit });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnread(userId);
  }

  async getNotification(
    notificationId: string,
    userId: string,
  ): Promise<DomainNotification | null> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      return null;
    }

    return notification;
  }

  async create(params: CreateNotificationParams): Promise<DomainNotification> {
    const notification = await this.notificationRepository.create(params);

    this.logger.info({
      event: 'notification_created',
      notificationId: notification.notificationId,
      userId: params.userId,
      type: params.type,
    });

    return notification;
  }
}
