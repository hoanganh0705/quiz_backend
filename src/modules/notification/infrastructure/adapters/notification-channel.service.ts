/**
 * Notification Channel Service
 *
 * Infrastructure adapter that handles notification delivery across channels
 * (in-app, email, push). Applies user preferences and quiet-hours rules
 * before creating and dispatching notifications. User preferences are cached
 * in Redis for 5 minutes to avoid repeated DB fetches.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  NotificationType,
  NotificationChannel,
  NotificationPreferencesRow,
} from '../../domain/types/notification.types';
import {
  NOTIFICATION_REPOSITORY_PORT,
  NOTIFICATION_DOMAIN_EVENT_BUS,
  type NotificationRepositoryPort,
  type NotificationDomainEventBus,
  type NotificationChannelServiceInstance,
} from '../../domain/ports/notification-ports';
import type { NotificationSentEvent } from '../../domain/events/notification.events';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const NOTIF_PREFS_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class NotificationChannelService implements NotificationChannelServiceInstance {
  private readonly cacheKeyPrefix = 'notif:prefs:';

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
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

  /**
   * Invalidate the cached preferences for a user. Call this after updating preferences.
   */
  async invalidatePreferencesCache(userId: string): Promise<void> {
    if (!this.cache) return;
    await this.cache.set(this.cacheKeyPrefix + userId, '', 0);
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

  private async getPreferences(userId: string): Promise<NotificationPreferencesRow | null> {
    if (this.cache) {
      const cached = await this.cache.get(this.cacheKeyPrefix + userId);
      if (cached !== null) {
        if (cached === '') {
          return null;
        }
        try {
          return JSON.parse(cached) as NotificationPreferencesRow;
        } catch {
          this.logger?.warn({ event: 'prefs_cache_parse_failed', userId });
        }
      }
    }

    const prefs = await this.notificationRepository.getPreferences(userId);

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

    const notification = await this.notificationRepository.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.body,
      metadata: params.metadata,
      channel,
    });

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
        await this.sendInApp(notification);
        break;
      case 'email':
        await this.sendEmail(notification, params.recipientEmail);
        break;
      case 'push':
        await this.sendPush(notification, params.pushToken);
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

    switch (channel) {
      case 'in_app':
        if (!prefs.inAppEnabled) return false;
        break;
      case 'email':
        if (!prefs.emailEnabled) return false;
        break;
      case 'push':
        if (!prefs.pushEnabled) return false;
        break;
    }

    switch (type) {
      case 'achievement_earned':
      case 'badge_unlocked':
      case 'badge_earned':
      case 'badge_revoked':
      case 'streak_milestone':
        if (!prefs.achievementEnabled) return false;
        break;
      case 'rank_achievement':
      case 'rank_improvement':
      case 'period_winner':
      case 'rank_improved':
      case 'rank_milestone':
        if (!prefs.rankEnabled) return false;
        break;
      case 'tournament_invite':
      case 'tournament_starting':
      case 'tournament_completed':
      case 'tournament_won':
      case 'tournament_started':
      case 'tournament_reminder':
        if (!prefs.tournamentEnabled) return false;
        break;
      case 'friend_request':
      case 'friend_accepted':
      case 'followed':
        if (!prefs.friendEnabled) return false;
        break;
      case 'discussion_reply':
      case 'discussion_mention':
      case 'discussion_solved':
        if (!prefs.discussionEnabled) return false;
        break;
      case 'weekly_summary':
        if (!prefs.summaryEnabled) return false;
        break;
      case 'system_announcement':
      case 'quiz_review_received':
        break;
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

  private async sendInApp(notification: { notificationId: string; userId: string }): Promise<void> {
    this.logger?.info({
      event: 'in_app_notification_sent',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'in_app',
    });
  }

  private async sendEmail(
    notification: { notificationId: string; userId: string },
    recipientEmail?: string,
  ): Promise<void> {
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

  private async sendPush(
    notification: { notificationId: string; userId: string },
    pushToken?: string,
  ): Promise<void> {
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
