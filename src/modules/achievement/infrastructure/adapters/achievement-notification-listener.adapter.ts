/**
 * Achievement Notification Listener
 *
 * Subscribes to Achievement domain events and dispatches notifications via
 * ACHIEVEMENT_NOTIFICATION_PORT. The Notification module owns the implementation
 * (AchievementNotificationService) and exports it through the port token, so
 * Achievement does not reach into Notification internals.
 *
 * Hosted in AchievementModule to avoid cross-module import cycles.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  ACHIEVEMENT_DOMAIN_EVENT_BUS,
  AchievementDomainEventBus,
} from '../../domain/events/achievement-domain.event-bus';
import type {
  AchievementDomainEvent as PublishedAchievementDomainEvent,
  AchievementAwardedEvent as PublishedAchievementAwardedEvent,
  BadgeEarnedEvent as PublishedBadgeEarnedEvent,
  BadgeRevokedEvent as PublishedBadgeRevokedEvent,
  StreakMilestoneEvent as PublishedStreakMilestoneEvent,
} from '../../domain/events/achievement.events';
import {
  ACHIEVEMENT_NOTIFICATION_PORT,
  type AchievementNotificationPort,
} from '@/modules/notification/domain/ports';

@Injectable()
export class AchievementNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ACHIEVEMENT_DOMAIN_EVENT_BUS)
    private readonly achievementEventBus: AchievementDomainEventBus,
    @Inject(forwardRef(() => ACHIEVEMENT_NOTIFICATION_PORT))
    private readonly achievementNotifications: AchievementNotificationPort,
    @InjectPinoLogger(AchievementNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();

    this.logger.info({
      event: 'achievement_notification_listener_initialized',
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
    try {
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
    } catch (error) {
      this.logger.error({
        event: 'achievement_notification_dispatch_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleAchievementAwarded(event: PublishedAchievementAwardedEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    try {
      await this.achievementNotifications.notifyAchievementEarned({
        userId: event.userId,
        achievementType: event.achievementType,
        badgeType: event.badgeType,
        badgeName: event.badgeType,
        category: event.achievementType,
      });
      this.logger.info({
        event: 'achievement_notification_sent',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
        achievementType: event.achievementType,
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_notification_failed',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleBadgeEarned(event: PublishedBadgeEarnedEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    try {
      await this.achievementNotifications.notifyBadgeUnlocked({
        userId: event.userId,
        badgeType: event.badgeType,
        badgeName: event.badgeType,
        category: event.badgeType,
      });
      this.logger.info({
        event: 'badge_unlock_notification_sent',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
      });
    } catch (error) {
      this.logger.error({
        event: 'badge_unlock_notification_failed',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleBadgeRevoked(event: PublishedBadgeRevokedEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    try {
      await this.achievementNotifications.notifyBadgeRevoked({
        userId: event.userId,
        badgeId: event.badgeId,
        badgeType: event.badgeType,
        reason: event.reason,
        revokedBy: event.revokedBy,
      });
      this.logger.info({
        event: 'badge_revoked_notification_sent',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
      });
    } catch (error) {
      this.logger.error({
        event: 'badge_revoked_notification_failed',
        correlationId,
        userId: event.userId,
        badgeType: event.badgeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleStreakMilestone(event: PublishedStreakMilestoneEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    try {
      await this.achievementNotifications.notifyStreakMilestone({
        userId: event.userId,
        streakDays: event.streakDays,
        milestone: event.streakDays,
      });
      this.logger.info({
        event: 'streak_milestone_notification_sent',
        correlationId,
        userId: event.userId,
        streakDays: event.streakDays,
      });
    } catch (error) {
      this.logger.error({
        event: 'streak_milestone_notification_failed',
        correlationId,
        userId: event.userId,
        streakDays: event.streakDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
