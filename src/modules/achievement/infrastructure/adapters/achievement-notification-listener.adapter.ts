/**
 * Achievement Notification Listener
 *
 * Subscribes to Achievement domain events and dispatches notifications.
 * Hosted in AchievementModule to avoid cross-module import cycles.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
import { NOTIFICATION_CHANNEL_SERVICE } from '@/modules/notification/domain/ports';
import type { NotificationChannelServicePort } from '@/modules/notification/domain/ports';

@Injectable()
export class AchievementNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ACHIEVEMENT_DOMAIN_EVENT_BUS)
    private readonly achievementEventBus: AchievementDomainEventBus,
    @Inject(NOTIFICATION_CHANNEL_SERVICE)
    private readonly channelService: NotificationChannelServicePort,
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

  private async handleAchievementAwarded(event: PublishedAchievementAwardedEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    try {
      const title = 'Achievement Unlocked';
      const body = `You earned the ${event.badgeType.replace(/_/g, ' ')} badge`;

      await this.channelService.send({
        userId: event.userId,
        type: 'achievement_earned',
        title,
        body,
        metadata: {
          achievementType: event.achievementType,
          badgeType: event.badgeType,
        },
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
      const title = 'Badge Earned';
      const body = `You earned the ${event.badgeType.replace(/_/g, ' ')} badge`;

      await this.channelService.send({
        userId: event.userId,
        type: 'badge_unlocked',
        title,
        body,
        metadata: { badgeType: event.badgeType },
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
      const title = 'Badge Revoked';
      const body = `The ${event.badgeType.replace(/_/g, ' ')} badge was revoked`;

      await this.channelService.send({
        userId: event.userId,
        type: 'badge_revoked',
        title,
        body,
        metadata: {
          badgeType: event.badgeType,
          reason: event.reason,
        },
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
      const title = 'Streak Milestone';
      const body = `You have maintained a ${event.streakDays}-day streak`;

      await this.channelService.send({
        userId: event.userId,
        type: 'streak_milestone',
        title,
        body,
        metadata: { streakDays: event.streakDays },
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
