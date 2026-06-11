import type {
  Notification,
  NotificationPreferencesRow,
  CreateNotificationParams,
  NotificationListParams,
} from '../types/notification.types';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NOTIFICATION_REPOSITORY_PORT');
export const NOTIFICATION_CHANNEL_SERVICE = Symbol('NOTIFICATION_CHANNEL_SERVICE');
export const NOTIFICATION_CHANNEL_SERVICE_INSTANCE = Symbol('NOTIFICATION_CHANNEL_SERVICE_INSTANCE');
// NOTIFICATION_DOMAIN_EVENT_BUS is re-exported below from the event bus module

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

  getPreferences(userId: string): Promise<NotificationPreferencesRow | null>;
  upsertPreferences(
    userId: string,
    prefs: Partial<NotificationPreferencesRow>,
  ): Promise<NotificationPreferencesRow>;

  /**
   * Permanently deletes all expired notifications (expiresAt < now).
   * Returns the number of notifications deleted.
   */
  deleteExpired(): Promise<number>;

  /**
   * Returns aggregated notification statistics for the admin dashboard.
   */
  getAnalytics(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    last24h: number;
    last7d: number;
  }>;
}

export interface NotificationSenderPort {
  send(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channels?: string[];
  }): Promise<void>;
}

export interface NotificationChannelServiceInstance {
  invalidatePreferencesCache(userId: string): Promise<void>;
}

export type NotificationChannelServicePort = NotificationSenderPort;

// Re-export event bus for consumers who only import from ports
export {
  NotificationDomainEventBus,
  NOTIFICATION_DOMAIN_EVENT_BUS,
} from '../events/notification-domain.event-bus';
export type { NotificationDomainEvent } from '../events/notification.events';
