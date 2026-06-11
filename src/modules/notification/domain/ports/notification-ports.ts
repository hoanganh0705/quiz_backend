import type {
  Notification,
  NotificationAnalytics,
  NotificationPreferencesRow,
  CreateNotificationParams,
  NotificationListParams,
} from '../types/notification.types';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NOTIFICATION_REPOSITORY_PORT');
export const NOTIFICATION_SERVICE_PORT = Symbol('NOTIFICATION_SERVICE_PORT');
export const NOTIFICATION_CHANNEL_SERVICE = Symbol('NOTIFICATION_CHANNEL_SERVICE');

export interface NotificationRepositoryPort {
  create(params: CreateNotificationParams): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUser(params: NotificationListParams & { userId: string }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAsUnread(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  deleteReadNotifications(userId: string): Promise<number>;
  delete(notificationId: string, userId: string): Promise<void>;
  softDelete(notificationId: string, userId: string): Promise<void>;
  deleteExpired(): Promise<void>;

  getAnalytics(userId: string): Promise<NotificationAnalytics>;

  getPreferences(userId: string): Promise<NotificationPreferencesRow | null>;
  upsertPreferences(
    userId: string,
    prefs: Partial<NotificationPreferencesRow>,
  ): Promise<NotificationPreferencesRow>;
}

export interface NotificationServicePort {
  create(params: CreateNotificationParams): Promise<Notification>;
  getNotifications(userId: string, params: NotificationListParams): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAsUnread(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  deleteReadNotifications(userId: string): Promise<number>;
  deleteNotification(notificationId: string, userId: string): Promise<void>;
}

export interface NotificationSender {
  send(notification: Notification): Promise<void>;
}
