import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  NotificationType,
  NotificationChannel,
  NotificationPreferencesRow,
} from '../types/notification.types';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../ports';

@Injectable()
export class NotificationChannelService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationChannelService.name)
    private readonly logger: PinoLogger,
  ) {}

  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channels?: NotificationChannel[];
  }): Promise<void> {
    const channels = params.channels ?? (['in_app'] as NotificationChannel[]);

    for (const channel of channels) {
      await this.sendToChannel(params, channel);
    }
  }

  private async sendToChannel(
    params: {
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
    },
    channel: NotificationChannel,
  ): Promise<void> {
    const shouldSend = await this.shouldSendNotification(params.userId, params.type, channel);
    if (!shouldSend) {
      this.logger.info({
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

    switch (channel) {
      case 'in_app':
        await this.sendInApp(notification);
        break;
      case 'email':
        await this.sendEmail(notification);
        break;
      case 'push':
        await this.sendPush(notification);
        break;
    }
  }

  private async shouldSendNotification(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const prefs = await this.notificationRepository.getPreferences(userId);
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
      this.logger.info({
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

  private sendInApp(notification: { notificationId: string; userId: string }): Promise<void> {
    this.logger.info({
      event: 'in_app_notification_sent',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'in_app',
    });

    return Promise.resolve();
  }

  private sendEmail(notification: { notificationId: string; userId: string }): Promise<void> {
    this.logger.info({
      event: 'email_notification_queued',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'email',
    });

    return Promise.resolve();
  }

  private sendPush(notification: { notificationId: string; userId: string }): Promise<void> {
    this.logger.info({
      event: 'push_notification_queued',
      notificationId: notification.notificationId,
      userId: notification.userId,
      channel: 'push',
    });

    return Promise.resolve();
  }
}
