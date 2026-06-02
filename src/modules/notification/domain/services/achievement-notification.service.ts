/**
 * Achievement Notification Service
 *
 * Composes and sends achievement-related notifications.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from './channel.service';

export interface AchievementNotificationParams {
  userId: string;
  achievementType: string;
  badgeType: string;
  badgeName: string;
  badgeDescription?: string;
  badgeIconUrl?: string;
  category: string;
}

export interface StreakNotificationParams {
  userId: string;
  streakDays: number;
  milestone: number;
}

@Injectable()
export class AchievementNotificationService {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(AchievementNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Send an achievement/badge earned notification.
   */
  async notifyAchievementEarned(params: AchievementNotificationParams): Promise<void> {
    const title = 'Achievement Unlocked!';
    const body = `You earned the "${params.badgeName}" badge!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'achievement_earned',
      title,
      body,
      metadata: {
        achievementType: params.achievementType,
        badgeType: params.badgeType,
        badgeName: params.badgeName,
        badgeDescription: params.badgeDescription,
        badgeIconUrl: params.badgeIconUrl,
        category: params.category,
      },
    });

    this.logger.info({
      event: 'achievement_notification_sent',
      userId: params.userId,
      badgeType: params.badgeType,
      badgeName: params.badgeName,
    });
  }

  /**
   * Send a badge unlocked notification (alias for achievement_earned).
   */
  async notifyBadgeUnlocked(
    params: Omit<AchievementNotificationParams, 'achievementType'>,
  ): Promise<void> {
    const title = 'Badge Unlocked!';
    const body = `You unlocked the "${params.badgeName}" badge!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'badge_unlocked',
      title,
      body,
      metadata: {
        badgeType: params.badgeType,
        badgeName: params.badgeName,
        badgeDescription: params.badgeDescription,
        badgeIconUrl: params.badgeIconUrl,
        category: params.category,
      },
    });

    this.logger.info({
      event: 'badge_unlocked_notification_sent',
      userId: params.userId,
      badgeType: params.badgeType,
    });
  }

  /**
   * Send a streak milestone notification.
   */
  async notifyStreakMilestone(params: StreakNotificationParams): Promise<void> {
    const title = 'Streak Milestone!';
    const body = `Amazing! You have maintained a ${params.streakDays}-day streak!`;

    await this.channelService.send({
      userId: params.userId,
      type: 'streak_milestone',
      title,
      body,
      metadata: {
        streakDays: params.streakDays,
        milestone: params.milestone,
      },
    });

    this.logger.info({
      event: 'streak_milestone_notification_sent',
      userId: params.userId,
      streakDays: params.streakDays,
      milestone: params.milestone,
    });
  }
}
