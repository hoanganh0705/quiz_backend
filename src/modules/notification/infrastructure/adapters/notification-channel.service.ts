import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  NotificationType,
  NotificationChannel,
  NotificationPreferencesRow,
  Notification as DomainNotification,
} from '../../domain/types/notification.types';
import {
  NOTIFICATION_REPOSITORY_PORT,
  NOTIFICATION_PREFERENCES_REPOSITORY_PORT,
  NOTIFICATION_DOMAIN_EVENT_BUS,
  type NotificationRepositoryPort,
  type NotificationPreferencesRepositoryPort,
  type NotificationDomainEventBus,
  type NotificationChannelServiceInstance,
} from '../../domain/ports';
import type { NotificationSentEvent } from '../../domain/events/notification.events';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  NOTIFICATION_TYPE_CATEGORY,
  NOTIFICATION_CHANNEL_GATE,
  type NotificationPreferenceCategory,
} from '../../domain/notification-preference-category';

const NOTIF_PREFS_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class NotificationChannelService implements NotificationChannelServiceInstance {
  private readonly cacheKeyPrefix = 'notif:prefs:';

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY_PORT)
    private readonly preferencesRepository: NotificationPreferencesRepositoryPort,
    @Optional()
    @Inject(NOTIFICATION_DOMAIN_EVENT_BUS)
    private readonly eventBus?: NotificationDomainEventBus,
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cache?: CacheProvider,
    @Optional()
    @InjectPinoLogger(NotificationChannelService.name)
    private readonly logger?: PinoLogger,
  ) {}

  async invalidatePreferencesCache(userId: string): Promise<void> {
    if (!this.cache) return;
    await this.cache.del(this.cacheKeyPrefix + userId);
  }

  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channels?: NotificationChannel[];
    recipientEmail?: string;
    pushToken?: string;
  }): Promise<void> {
    const channels = params.channels ?? (['in_app'] as NotificationChannel[]);

    const prefs = await this.getPreferences(params.userId);

    for (const channel of channels) {
      await this.sendToChannel(params, channel, prefs);
    }
  }

  async sendBatch(
    params: {
      type: NotificationType;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
      channels?: NotificationChannel[];
      recipientEmail?: string;
      pushToken?: string;
    },
    userIds: string[],
  ): Promise<{ sent: number; skipped: number }> {
    const channels = params.channels ?? (['in_app'] as NotificationChannel[]);
    let sent = 0;
    let skipped = 0;

    const cachedPrefs = new Map<string, NotificationPreferencesRow | null>();
    for (const userId of userIds) {
      if (!cachedPrefs.has(userId)) {
        cachedPrefs.set(userId, await this.getPreferences(userId));
      }
    }

    for (const [userId, prefs] of cachedPrefs) {
      for (const channel of channels) {
        const shouldSend = this.shouldSendNotification(userId, params.type, channel, prefs);
        if (shouldSend) {
          try {
            await this.notificationRepository.create({
              userId,
              type: params.type,
              title: params.title,
              message: params.body,
              metadata: params.metadata,
              channel,
            });
            sent++;
          } catch (error) {
            this.logger?.error({
              event: 'batch_notification_send_failed',
              userId,
              type: params.type,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          skipped++;
        }
      }
    }

    this.logger?.info({
      event: 'batch_notification_complete',
      total: userIds.length,
      sent,
      skipped,
    });

    return { sent, skipped };
  }

  private async getPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
    if (this.cache) {
      const cached = await this.cache.get(this.cacheKeyPrefix + userId);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as NotificationPreferencesRow;
        } catch {
          this.logger?.warn({ event: 'prefs_cache_parse_failed', userId });
        }
      }
    }

    const prefs = await this.preferencesRepository.getPreferences(userId);

    if (this.cache) {
      const cacheValue = prefs ? JSON.stringify(prefs) : '';
      await this.cache.set(this.cacheKeyPrefix + userId, cacheValue, NOTIF_PREFS_TTL_MS);
    }

    return prefs;
  }

  private async sendToChannel(
    params: {
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
      recipientEmail?: string;
      pushToken?: string;
    },
    channel: NotificationChannel,
    prefs: NotificationPreferencesRow | null,
  ): Promise<void> {
    const shouldSend = this.shouldSendNotification(params.userId, params.type, channel, prefs);
    if (!shouldSend) {
      this.logger?.info({
        event: 'notification_skipped_by_preferences',
        userId: params.userId,
        type: params.type,
        channel,
      });
      return;
    }

    let notification: DomainNotification;
    try {
      notification = await this.notificationRepository.create({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.body,
        metadata: params.metadata,
        channel,
      });
    } catch (error) {
      this.logger?.error({
        event: 'notification_create_failed',
        userId: params.userId,
        type: params.type,
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const sentEvent: NotificationSentEvent = {
      eventType: 'notification.sent',
      notificationId: notification.notificationId,
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel,
      timestamp: new Date(),
    };
    this.eventBus?.emit(sentEvent);

    switch (channel) {
      case 'in_app':
        this.sendInApp(notification);
        break;
      case 'email':
        this.sendEmail(notification, params.recipientEmail);
        break;
      case 'push':
        this.sendPush(notification, params.pushToken);
        break;
    }
  }

  private shouldSendNotification(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    prefs: NotificationPreferencesRow | null,
  ): boolean {
    if (!prefs) {
      return true;
    }

    const channelField = NOTIFICATION_CHANNEL_GATE[channel];
    if (!prefs[channelField]) {
      return false;
    }

    const category: NotificationPreferenceCategory = NOTIFICATION_TYPE_CATEGORY[type];
    if (this.isCategoryDisabled(prefs, category)) {
      return false;
    }

    if (this.isInQuietHours(prefs)) {
      this.logger?.info({
        event: 'notification_skipped_quiet_hours',
        userId,
        quietHoursStart: prefs.quietHoursStart,
        quietHoursEnd: prefs.quietHoursEnd,
      });
      return false;
    }

    return true;
  }

  private isCategoryDisabled(
    prefs: NotificationPreferencesRow,
    category: NotificationPreferenceCategory,
  ): boolean {
    switch (category) {
      case 'achievement':
        return !prefs.achievementEnabled;
      case 'tournament':
        return !prefs.tournamentEnabled;
      case 'rank':
        return !prefs.rankEnabled;
      case 'friend':
        return !prefs.friendEnabled;
      case 'comment':
        return !prefs.commentEnabled;
      case 'summary':
        return !prefs.summaryEnabled;
      case 'security':
      case 'system':
        return false;
    }
  }

  private isInQuietHours(prefs: NotificationPreferencesRow): boolean {
    if (!prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }

    return currentTime >= startTime && currentTime <= endTime;
  }

  private sendInApp(notification: { notificationId: string; userId: string }): void {
    this.logger?.info({
      event: 'in_app_notification_sent',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'in_app',
    });
  }

  private sendEmail(
    notification: { notificationId: string; userId: string },
    recipientEmail?: string,
  ): void {
    if (!recipientEmail) {
      this.logger?.warn({
        event: 'email_notification_skipped_no_recipient',
        notificationId: notification.notificationId,
        userId: notification.userId,
        reason: 'recipientEmail not provided',
      });
      return;
    }

    this.logger?.info({
      event: 'email_notification_queued',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'email',
    });
  }

  private sendPush(
    notification: { notificationId: string; userId: string },
    pushToken?: string,
  ): void {
    if (!pushToken) {
      this.logger?.warn({
        event: 'push_notification_skipped_no_token',
        notificationId: notification.notificationId,
        userId: notification.userId,
        reason: 'pushToken not provided',
      });
      return;
    }

    this.logger?.info({
      event: 'push_notification_queued',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'push',
    });
  }
}
