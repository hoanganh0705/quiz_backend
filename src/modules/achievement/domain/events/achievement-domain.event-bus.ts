/**
 * Achievement Domain Event Bus
 *
 * Publishes and subscribes to achievement domain events.
 * Other domains can subscribe to these events for notifications and integration.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AchievementDomainEvent } from '../events/achievement.events';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

export type EventHandler<T extends AchievementDomainEvent = AchievementDomainEvent> = (
  event: T,
) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

@Injectable()
export class AchievementDomainEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  constructor(
    @InjectPinoLogger(AchievementDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Subscribe to a specific event type.
   */
  subscribe<T extends AchievementDomainEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>,
  ): EventSubscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as EventHandler);

    this.logger.debug({
      event: 'event_subscription_created',
      eventType,
    });

    return {
      unsubscribe: () => {
        handlers.delete(handler as EventHandler);
        this.logger.debug({
          event: 'event_subscription_removed',
          eventType,
        });
      },
    };
  }

  /**
   * Subscribe to all achievement events.
   */
  subscribeAll(handler: EventHandler): EventSubscription {
    this.globalHandlers.add(handler);

    this.logger.debug({
      event: 'global_event_subscription_created',
    });

    return {
      unsubscribe: () => {
        this.globalHandlers.delete(handler);
        this.logger.debug({
          event: 'global_event_subscription_removed',
        });
      },
    };
  }

  /**
   * Publish an achievement awarded event.
   */
  emitAchievementAwarded(params: {
    userId: string;
    badgeId: string;
    badge: BadgeDefinitionRow;
    metadata?: Record<string, unknown>;
  }): void {
    const event = {
      eventType: 'achievement.awarded' as const,
      userId: params.userId,
      achievementType: params.badge.category,
      badgeType: params.badge.slug,
      period: params.metadata?.period as string | undefined,
      rank: params.metadata?.rank as number | undefined,
      timestamp: new Date(),
    };

    this.publish(event);
  }

  /**
   * Publish a badge earned event.
   */
  emitBadgeEarned(params: {
    userId: string;
    badgeSlug: string;
    badgeName: string;
  }): void {
    const event = {
      eventType: 'badge.earned' as const,
      userId: params.userId,
      badgeType: params.badgeSlug as 'rising_star' | 'veteran' | 'newcomer' | 'top10' | 'top100' | 'top1000',
      awardedAt: new Date(),
    };

    this.publish(event);
  }

  /**
   * Publish a streak milestone event.
   */
  emitStreakMilestone(params: {
    userId: string;
    streakDays: number;
  }): void {
    const event = {
      eventType: 'streak.milestone' as const,
      userId: params.userId,
      streakDays: params.streakDays,
      timestamp: new Date(),
    };

    this.publish(event);
  }

  /**
   * Publish a generic achievement event.
   */
  emit(event: AchievementDomainEvent): void {
    this.publish(event);
  }

  /**
   * Internal publish method.
   */
  private publish(event: AchievementDomainEvent): void {
    this.logger.info({
      event: 'achievement_event_published',
      eventType: event.eventType,
      userId: event.userId,
    });

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.logger.error({
              event: 'event_handler_error',
              handler: 'global',
              eventType: event.eventType,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'event_handler_error',
          handler: 'global',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error) => {
              this.logger.error({
                event: 'event_handler_error',
                handler: event.eventType,
                eventType: event.eventType,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            });
          }
        } catch (error) {
          this.logger.error({
            event: 'event_handler_error',
            handler: event.eventType,
            eventType: event.eventType,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
    this.logger.info({
      event: 'event_bus_cleared',
    });
  }

  /**
   * Get the number of handlers for a specific event type.
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Get the total number of global handlers.
   */
  getGlobalHandlerCount(): number {
    return this.globalHandlers.size;
  }
}
