import type {
  Notification,
  CreateNotificationParams,
  NotificationListParams,
  NotificationType,
  NotificationChannel,
} from '../types/notification.types';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NOTIFICATION_REPOSITORY_PORT');
export const NOTIFICATION_CHANNEL_SERVICE = Symbol('NOTIFICATION_CHANNEL_SERVICE');
export const NOTIFICATION_CHANNEL_SERVICE_INSTANCE = Symbol(
  'NOTIFICATION_CHANNEL_SERVICE_INSTANCE',
);

export const SOCIAL_NOTIFICATION_PORT = Symbol('SOCIAL_NOTIFICATION_PORT');
export const ACHIEVEMENT_NOTIFICATION_PORT = Symbol('ACHIEVEMENT_NOTIFICATION_PORT');
export const TOURNAMENT_NOTIFICATION_PORT = Symbol('TOURNAMENT_NOTIFICATION_PORT');
export const INSTANCE_NOTIFICATION_PORT = Symbol('INSTANCE_NOTIFICATION_PORT');
export const RANK_NOTIFICATION_PORT = Symbol('RANK_NOTIFICATION_PORT');

export interface NotificationRepositoryPort {
  create(params: CreateNotificationParams): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUser(params: NotificationListParams & { userId: string }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAsUnread(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  deleteReadNotifications(userId: string): Promise<number>;
  delete(notificationId: string, userId: string): Promise<void>;
  softDelete(notificationId: string, userId: string): Promise<void>;
  listUnreadIds(userId: string, limit?: number): Promise<string[]>;
  listReadIds(userId: string, limit?: number): Promise<string[]>;

  deleteExpired(): Promise<number>;

  getAnalytics(): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    last24h: number;
    last7d: number;
  }>;

  invalidateAnalyticsCache(): Promise<void>;

  findByIdempotencyKey(idempotencyKey: string, userId: string): Promise<Notification | null>;
}

export interface NotificationSenderPort {
  send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channels?: NotificationChannel[];
    recipientEmail?: string;
    pushToken?: string;
  }): Promise<void>;
  sendBatch(
    params: {
      type: NotificationType;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
      channels?: NotificationChannel[];
    },
    userIds: string[],
  ): Promise<{ sent: number; skipped: number }>;
}

export interface NotificationChannelServiceInstance {
  invalidatePreferencesCache(userId: string): Promise<void>;
}

export type NotificationChannelServicePort = NotificationSenderPort;

export type { SocialNotificationPort } from '../services/social-notification.service';
export type { AchievementNotificationPort } from '../services/achievement-notification.service';
export type { TournamentNotificationPort } from '../services/tournament-notification.service';
export type { InstanceNotificationPort } from '../services/instance-notification.service';
export type { RankNotificationPort } from '../services/rank-notification.service';

export {
  NotificationDomainEventBus,
  NOTIFICATION_DOMAIN_EVENT_BUS,
} from '../events/notification-domain.event-bus';
export type { NotificationDomainEvent } from '../events/notification.events';
