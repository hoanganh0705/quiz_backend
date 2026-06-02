/**
 * Badge Notification Service
 *
 * Handles notifications when badges are awarded:
 * - In-app notifications
 * - Achievement earned events for other systems
 * - Activity feed updates
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementDomainEvent } from '../events/achievement.events';

export interface BadgeNotificationPayload {
  userId: string;
  badge: BadgeDefinitionRow;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface NotificationChannel {
  type: 'in_app' | 'webhook' | 'email' | 'push';
  enabled: boolean;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  includeProgress: boolean;
  groupSimilar: boolean;
  groupWindowMs: number;
}

@Injectable()
export class BadgeNotificationService {
  private notificationConfig: NotificationConfig = {
    channels: [
      { type: 'in_app', enabled: true },
      { type: 'webhook', enabled: false },
      { type: 'email', enabled: false },
      { type: 'push', enabled: false },
    ],
    includeProgress: true,
    groupSimilar: true,
    groupWindowMs: 5000, // Group notifications within 5 seconds
  };

  private pendingNotifications: Map<string, BadgeNotificationPayload[]> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(BadgeNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Notify when a badge is awarded.
   */
  async notifyBadgeAwarded(
    userId: string,
    badgeId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      this.logger.warn({
        event: 'badge_notification_skipped',
        reason: 'badge_not_found',
        badgeId,
      });
      return;
    }

    const payload: BadgeNotificationPayload = {
      userId,
      badge,
      metadata,
      timestamp: new Date(),
    };

    if (this.notificationConfig.groupSimilar) {
      this.queueGroupedNotification(userId, payload);
    } else {
      await this.sendNotification(payload);
    }
  }

  /**
   * Queue a notification for grouping with similar notifications.
   */
  private queueGroupedNotification(userId: string, payload: BadgeNotificationPayload): void {
    const existing = this.pendingNotifications.get(userId) ?? [];
    existing.push(payload);
    this.pendingNotifications.set(userId, existing);

    // Clear existing timer
    const existingTimer = this.flushTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to flush
    const timer = setTimeout(() => {
      void this.flushNotifications(userId);
    }, this.notificationConfig.groupWindowMs);

    this.flushTimers.set(userId, timer);
  }

  /**
   * Flush all pending notifications for a user.
   */
  private async flushNotifications(userId: string): Promise<void> {
    const notifications = this.pendingNotifications.get(userId) ?? [];
    this.pendingNotifications.delete(userId);
    this.flushTimers.delete(userId);

    if (notifications.length === 0) return;

    // Group by category
    const grouped = this.groupNotifications(notifications);

    for (const group of grouped) {
      await this.sendNotification(group);
    }
  }

  /**
   * Group notifications by category.
   */
  private groupNotifications(
    notifications: BadgeNotificationPayload[],
  ): BadgeNotificationPayload[] {
    const groups: Map<string, BadgeNotificationPayload[]> = new Map();

    for (const notification of notifications) {
      const key = notification.badge.category;
      const existing = groups.get(key) ?? [];
      existing.push(notification);
      groups.set(key, existing);
    }

    // Create summary notification for each group
    const result: BadgeNotificationPayload[] = [];

    for (const [category, items] of groups) {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        // Create a summary notification
        result.push({
          userId: items[0].userId,
          badge: {
            ...items[0].badge,
            name: `${items.length} ${category} badges`,
            description: `You earned ${items.length} ${category} badges!`,
          },
          metadata: {
            ...items[0].metadata,
            grouped: true,
            count: items.length,
            badges: items.map((n) => n.badge.slug),
          },
          timestamp: items[items.length - 1].timestamp,
        });
      }
    }

    return result;
  }

  /**
   * Send a notification through configured channels.
   */
  private async sendNotification(payload: BadgeNotificationPayload): Promise<void> {
    const event = this.createAchievementEvent(payload);

    for (const channel of this.notificationConfig.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'in_app':
            await this.sendInAppNotification(payload, event);
            break;
          case 'webhook':
            await this.sendWebhookNotification(payload, event);
            break;
          case 'email':
            await this.sendEmailNotification(payload, event);
            break;
          case 'push':
            await this.sendPushNotification(payload, event);
            break;
        }
      } catch (error) {
        this.logger.error({
          event: 'notification_send_failed',
          channel: channel.type,
          userId: payload.userId,
          badgeId: payload.badge.badgeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Create an achievement domain event.
   */
  private createAchievementEvent(payload: BadgeNotificationPayload): AchievementDomainEvent {
    return {
      eventType: 'achievement.awarded',
      userId: payload.userId,
      achievementType: payload.badge.category,
      badgeType: payload.badge.slug,
      timestamp: payload.timestamp,
    };
  }

  /**
   * Send in-app notification.
   */
  private sendInAppNotification(
    payload: BadgeNotificationPayload,
    event: AchievementDomainEvent,
  ): Promise<void> {
    // This would integrate with a notification service
    this.logger.info({
      event: 'in_app_notification_sent',
      achievementEvent: event,
      userId: payload.userId,
      badgeSlug: payload.badge.slug,
      badgeName: payload.badge.name,
      category: payload.badge.category,
    });
    return Promise.resolve();
  }

  /**
   * Send webhook notification.
   */
  private sendWebhookNotification(
    payload: BadgeNotificationPayload,
    event: AchievementDomainEvent,
  ): Promise<void> {
    // This would call external webhooks
    this.logger.info({
      event: 'webhook_notification_sent',
      achievementEvent: event,
      userId: payload.userId,
      badgeSlug: payload.badge.slug,
    });
    return Promise.resolve();
  }

  /**
   * Send email notification.
   */
  private sendEmailNotification(
    payload: BadgeNotificationPayload,
    event: AchievementDomainEvent,
  ): Promise<void> {
    // This would integrate with an email service
    this.logger.info({
      event: 'email_notification_sent',
      achievementEvent: event,
      userId: payload.userId,
      badgeSlug: payload.badge.slug,
    });
    return Promise.resolve();
  }

  /**
   * Send push notification.
   */
  private sendPushNotification(
    payload: BadgeNotificationPayload,
    event: AchievementDomainEvent,
  ): Promise<void> {
    // This would integrate with a push notification service
    this.logger.info({
      event: 'push_notification_sent',
      achievementEvent: event,
      userId: payload.userId,
      badgeSlug: payload.badge.slug,
    });
    return Promise.resolve();
  }

  /**
   * Update notification configuration.
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.notificationConfig = { ...this.notificationConfig, ...config };
    this.logger.info({
      event: 'notification_config_updated',
      config: this.notificationConfig,
    });
  }

  /**
   * Get current configuration.
   */
  getConfig(): NotificationConfig {
    return { ...this.notificationConfig };
  }

  /**
   * Enable a notification channel.
   */
  enableChannel(channelType: NotificationChannel['type']): void {
    const channel = this.notificationConfig.channels.find((c) => c.type === channelType);
    if (channel) {
      channel.enabled = true;
      this.logger.info({
        event: 'notification_channel_enabled',
        channel: channelType,
      });
    }
  }

  /**
   * Disable a notification channel.
   */
  disableChannel(channelType: NotificationChannel['type']): void {
    const channel = this.notificationConfig.channels.find((c) => c.type === channelType);
    if (channel) {
      channel.enabled = false;
      this.logger.info({
        event: 'notification_channel_disabled',
        channel: channelType,
      });
    }
  }

  /**
   * Flush all pending notifications (useful on shutdown).
   */
  async flushAll(): Promise<void> {
    const userIds = Array.from(this.pendingNotifications.keys());
    for (const userId of userIds) {
      await this.flushNotifications(userId);
    }
  }
}
