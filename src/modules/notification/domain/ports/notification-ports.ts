import type {
  Notification,
  NotificationPreferencesRow,
  CreateNotificationParams,
  NotificationListParams,
} from '../types/notification.types';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NOTIFICATION_REPOSITORY_PORT');
export const NOTIFICATION_SERVICE_PORT = Symbol('NOTIFICATION_SERVICE_PORT');

export interface NotificationRepositoryPort {
  create(params: CreateNotificationParams): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUser(params: NotificationListParams & { userId: string }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  delete(notificationId: string, userId: string): Promise<void>;
  softDelete(notificationId: string, userId: string): Promise<void>;
  deleteExpired(): Promise<void>;

  // Preferences
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
  markAllAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: string, userId: string): Promise<void>;
}

export interface NotificationSender {
  send(notification: Notification): Promise<void>;
}
