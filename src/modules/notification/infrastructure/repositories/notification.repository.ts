/**
 * Notification Repository Port
 *
 * Defines the interface for notification data access.
 */

import { NotificationChannel, NotificationType } from '../../domain/types/notification.types';

export type NotificationRow = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channel: NotificationChannel;
  readAt: Date | null;
  createdAt: Date;
};

export interface NotificationRepositoryPort {
  /**
   * Create a new notification.
   */
  createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channel: NotificationChannel;
  }): Promise<NotificationRow>;

  /**
   * Get notifications for a user.
   */
  getUserNotifications(userId: string, limit?: number): Promise<NotificationRow[]>;

  /**
   * Mark a notification as read.
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Get unread count for a user.
   */
  getUnreadCount(userId: string): Promise<number>;
}

export const NOTIFICATION_REPOSITORY_PORT: unique symbol = Symbol('NOTIFICATION_REPOSITORY_PORT');
