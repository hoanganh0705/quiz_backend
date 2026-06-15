/**
 * Shared Achievement Event Bus Adapter
 *
 * Bridges the internal AchievementDomainEventBus to the shared achievement event
 * bus port. Re-exports Achievement domain events as SharedAchievementDomainEvent
 * types so that external consumers (notably Social's feed listener) receive
 * well-defined, stable types rather than depending on Achievement module internals.
 *
 * This adapter subscribes to the internal bus and re-emits events on the shared bus.
 */

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AchievementDomainEventBus } from './achievement-domain.event-bus';
import type { AchievementDomainEvent } from './achievement.events';
import {
  SHARED_ACHIEVEMENT_EVENT_BUS,
  type SharedAchievementEventBusPort,
  type SharedAchievementDomainEvent,
  type SharedBadgeEarnedEvent,
  type SharedBadgeRevokedEvent,
} from '@/common/events/achievement-shared-events';

@Injectable()
export class SharedAchievementEventBusAdapter
  implements SharedAchievementEventBusPort, OnModuleInit, OnModuleDestroy
{
  private sharedHandlers: Array<(event: SharedAchievementDomainEvent) => void> = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly internalBus: AchievementDomainEventBus,
    @InjectPinoLogger(SharedAchievementEventBusAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const subscription = this.internalBus.subscribeAll((event) => {
      void this.forwardToSharedBus(event);
    });
    this.unsubscribe = () => subscription.unsubscribe();

    this.logger.info({
      event: 'shared_achievement_event_bus_adapter_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  subscribe(handler: (event: SharedAchievementDomainEvent) => void): () => void {
    this.sharedHandlers.push(handler);
    return () => {
      const index = this.sharedHandlers.indexOf(handler);
      if (index !== -1) {
        this.sharedHandlers.splice(index, 1);
      }
    };
  }

  private forwardToSharedBus(event: AchievementDomainEvent): void {
    const sharedEvent = this.toSharedEvent(event);
    if (!sharedEvent) return;

    for (const handler of this.sharedHandlers) {
      try {
        handler(sharedEvent);
      } catch (error) {
        this.logger.error({
          event: 'shared_achievement_handler_error',
          eventType: sharedEvent.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private toSharedEvent(event: AchievementDomainEvent): SharedAchievementDomainEvent | null {
    switch (event.eventType) {
      case 'achievement.awarded':
        return {
          eventType: 'achievement.awarded',
          userId: event.userId,
          achievementType: event.achievementType,
          badgeType: event.badgeType,
          period: event.period,
          rank: event.rank,
          timestamp: event.timestamp,
        };

      case 'badge.earned': {
        const shared: SharedBadgeEarnedEvent = {
          eventType: 'badge.earned',
          userId: event.userId,
          badgeType: event.badgeType,
          awardedAt: event.awardedAt,
        };
        return shared;
      }

      case 'badge.revoked': {
        const shared: SharedBadgeRevokedEvent = {
          eventType: 'badge.revoked',
          userId: event.userId,
          badgeId: event.badgeId,
          badgeType: event.badgeType,
          revokedAt: event.revokedAt,
          reason: event.reason,
          revokedBy: event.revokedBy,
        };
        return shared;
      }

      case 'streak.milestone':
        return {
          eventType: 'streak.milestone',
          userId: event.userId,
          streakDays: event.streakDays,
          timestamp: event.timestamp,
        };

      default:
        return null;
    }
  }
}

// Re-export the port symbol so the Achievement module can register the binding
// without reaching back into the common barrel.
export { SHARED_ACHIEVEMENT_EVENT_BUS };
