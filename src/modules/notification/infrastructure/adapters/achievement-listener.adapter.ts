/**
 * Achievement Event Listener Adapter
 *
 * Listens to Achievement domain events and triggers notifications.
 * This adapter bridges the Achievement domain to the Notification domain.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AchievementNotificationService } from '../../domain/services/achievement-notification.service';

export interface AchievementAwardedEvent {
  readonly eventType: 'achievement.awarded';
  readonly userId: string;
  readonly achievementType: string;
  readonly badgeType: string;
  readonly period?: string;
  readonly rank?: number;
  readonly timestamp: Date;
}

export interface BadgeEarnedEvent {
  readonly eventType: 'badge.earned';
  readonly userId: string;
  readonly badgeType: string;
  readonly badgeName?: string;
  readonly badgeDescription?: string;
  readonly badgeIconUrl?: string;
  readonly category?: string;
  readonly awardedAt: Date;
}

export interface StreakMilestoneEvent {
  readonly eventType: 'streak.milestone';
  readonly userId: string;
  readonly streakDays: number;
  readonly milestone: number;
  readonly timestamp: Date;
}

export type AchievementDomainEvent =
  | AchievementAwardedEvent
  | BadgeEarnedEvent
  | StreakMilestoneEvent;

@Injectable()
export class AchievementListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly achievementNotificationService: AchievementNotificationService,
    @InjectPinoLogger(AchievementListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'notification_achievement_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /**
   * Handle achievement awarded event from Achievement domain.
   */
  async handleAchievementAwarded(event: AchievementAwardedEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyAchievementEarned({
        userId: event.userId,
        achievementType: event.achievementType,
        badgeType: event.badgeType,
        badgeName: event.badgeType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        category: event.achievementType,
      });

      this.logger.info({
        event: 'achievement_notification_triggered',
        userId: event.userId,
        badgeType: event.badgeType,
        achievementType: event.achievementType,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_notification_failed',
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle badge earned event.
   */
  async handleBadgeEarned(event: BadgeEarnedEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyBadgeUnlocked({
        userId: event.userId,
        badgeType: event.badgeType,
        badgeName:
          event.badgeName ??
          event.badgeType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        badgeDescription: event.badgeDescription,
        badgeIconUrl: event.badgeIconUrl,
        category: event.category ?? 'general',
      });

      this.logger.info({
        event: 'badge_unlock_notification_triggered',
        userId: event.userId,
        badgeType: event.badgeType,
      });
    } catch (error) {
      this.logger.error({
        event: 'badge_unlock_notification_failed',
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle streak milestone event.
   */
  async handleStreakMilestone(event: StreakMilestoneEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyStreakMilestone({
        userId: event.userId,
        streakDays: event.streakDays,
        milestone: event.milestone,
      });

      this.logger.info({
        event: 'streak_milestone_notification_triggered',
        userId: event.userId,
        streakDays: event.streakDays,
        milestone: event.milestone,
      });
    } catch (error) {
      this.logger.error({
        event: 'streak_milestone_notification_failed',
        userId: event.userId,
        streakDays: event.streakDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
