/**
 * Notification Repository Implementation
 *
 * Stub implementation using in-memory storage.
 * Replace with actual database implementation when schema is ready.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationRepositoryPort, type NotificationRow } from './notification.repository';
import { NotificationChannel, NotificationType } from '../../domain/types/notification.types';

@Injectable()
export class NotificationRepository implements NotificationRepositoryPort {
  private readonly notifications: Map<string, NotificationRow[]> = new Map();

  constructor(
    @InjectPinoLogger(NotificationRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channel: NotificationChannel;
  }): Promise<NotificationRow> {
    const notification: NotificationRow = {
      id: crypto.randomUUID(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata,
      channel: params.channel,
      readAt: null,
      createdAt: new Date(),
    };

    if (!this.notifications.has(params.userId)) {
      this.notifications.set(params.userId, []);
    }

    this.notifications.get(params.userId)!.push(notification);

    this.logger.info({
      event: 'notification_created',
      notificationId: notification.id,
      userId: params.userId,
      channel: params.channel,
    });

    return Promise.resolve(notification);
  }

  getUserNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
    const userNotifications = this.notifications.get(userId) ?? [];
    return Promise.resolve(
      userNotifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit),
    );
  }

  markAsRead(notificationId: string): Promise<void> {
    for (const notifications of this.notifications.values()) {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) {
        notification.readAt = new Date();
        break;
      }
    }

    return Promise.resolve();
  }

  getUnreadCount(userId: string): Promise<number> {
    const userNotifications = this.notifications.get(userId) ?? [];
    return Promise.resolve(userNotifications.filter((n) => n.readAt === null).length);
  }
}
