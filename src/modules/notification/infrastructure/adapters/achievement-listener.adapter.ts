/**
 * Achievement Event Listener Adapter
 *
 * Listens to Achievement domain events and triggers notifications.
 * This adapter bridges the Achievement domain to the Notification domain.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AchievementDomainEventBus } from '@/modules/achievement/domain/events/achievement-domain.event-bus';
import type {
  AchievementDomainEvent as PublishedAchievementDomainEvent,
  AchievementAwardedEvent as PublishedAchievementAwardedEvent,
  BadgeEarnedEvent as PublishedBadgeEarnedEvent,
  BadgeRevokedEvent as PublishedBadgeRevokedEvent,
  StreakMilestoneEvent as PublishedStreakMilestoneEvent,
} from '@/modules/achievement/domain/events/achievement.events';
import { AchievementNotificationService } from '../../domain/services/achievement-notification.service';

@Injectable()
export class AchievementListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly achievementNotificationService: AchievementNotificationService,
    private readonly achievementEventBus: AchievementDomainEventBus,
    @InjectPinoLogger(AchievementListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();

    this.logger.info({
      event: 'notification_achievement_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    const subscription = this.achievementEventBus.subscribeAll((event) => {
      void this.handleEvent(event);
    });

    this.unsubscribe = () => subscription.unsubscribe();
  }

  private async handleEvent(event: PublishedAchievementDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'achievement.awarded':
        await this.handleAchievementAwarded(event);
        break;
      case 'badge.earned':
        await this.handleBadgeEarned(event);
        break;
      case 'badge.revoked':
        await this.handleBadgeRevoked(event);
        break;
      case 'streak.milestone':
        await this.handleStreakMilestone(event);
        break;
    }
  }

  async handleAchievementAwarded(event: PublishedAchievementAwardedEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyAchievementEarned({
        userId: event.userId,
        achievementType: event.achievementType,
        badgeType: event.badgeType,
        badgeName: event.badgeType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
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

  async handleBadgeEarned(event: PublishedBadgeEarnedEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyBadgeUnlocked({
        userId: event.userId,
        badgeType: event.badgeType,
        badgeName: event.badgeType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        category: 'general',
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

  async handleBadgeRevoked(event: PublishedBadgeRevokedEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyBadgeRevoked({
        userId: event.userId,
        badgeId: event.badgeId,
        badgeType: event.badgeType,
        reason: event.reason,
        revokedBy: event.revokedBy,
      });

      this.logger.info({
        event: 'badge_revoked_notification_triggered',
        userId: event.userId,
        badgeType: event.badgeType,
      });
    } catch (error) {
      this.logger.error({
        event: 'badge_revoked_notification_failed',
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleStreakMilestone(event: PublishedStreakMilestoneEvent): Promise<void> {
    try {
      await this.achievementNotificationService.notifyStreakMilestone({
        userId: event.userId,
        streakDays: event.streakDays,
        milestone: event.streakDays,
      });

      this.logger.info({
        event: 'streak_milestone_notification_triggered',
        userId: event.userId,
        streakDays: event.streakDays,
        milestone: event.streakDays,
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
