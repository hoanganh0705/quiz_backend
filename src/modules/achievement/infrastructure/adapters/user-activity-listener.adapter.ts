/**
 * User Activity Listener Adapter
 *
 * Listens to Achievement domain events and records activity events for the user module.
 * This adapter bridges the Achievement domain to the User activity timeline.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import { AchievementDomainEventBus } from '../../domain/events/achievement-domain.event-bus';
import type { AchievementDomainEvent } from '../../domain/events/achievement.events';
import type { UserActivityService } from '../../../user/application/user-activity.service';
import { USER_ACTIVITY_SERVICE } from '../../../user/application/user-activity.service';

const EVENT_METADATA_TRANSFORMERS: Record<
  string,
  (event: AchievementDomainEvent) => Record<string, unknown>
> = {
  'achievement.awarded': (e) => {
    const ev = e as Extract<AchievementDomainEvent, { eventType: 'achievement.awarded' }>;
    return {
      achievementType: ev.achievementType,
      badgeType: ev.badgeType,
      period: ev.period,
      rank: ev.rank,
    };
  },
  'badge.earned': (e) => {
    const ev = e as Extract<AchievementDomainEvent, { eventType: 'badge.earned' }>;
    return {
      badgeType: ev.badgeType,
    };
  },
  'streak.milestone': (e) => {
    const ev = e as Extract<AchievementDomainEvent, { eventType: 'streak.milestone' }>;
    return {
      streakDays: ev.streakDays,
    };
  },
};

@Injectable()
export class UserActivityListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly achievementEventBus: AchievementDomainEventBus,
    @Inject(USER_ACTIVITY_SERVICE)
    private readonly userActivityService: UserActivityService,
    @InjectPinoLogger(UserActivityListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
    this.logger.info({
      event: 'user_activity_listener_adapter_initialized',
    });
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.logger.info({
      event: 'user_activity_listener_adapter_destroyed',
    });
  }

  private subscribe(): void {
    const eventTypes = ['achievement.awarded', 'badge.earned', 'streak.milestone'];

    for (const eventType of eventTypes) {
      const subscription = this.achievementEventBus.subscribe(
        eventType as AchievementDomainEvent['eventType'],
        this.handleEvent.bind(this),
      );
      this.unsubscribes.push(() => subscription.unsubscribe());
    }

    this.logger.info({
      event: 'subscribed_to_achievement_events',
      eventTypes,
    });
  }

  private async handleEvent(event: AchievementDomainEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    this.logger.debug({
      event: 'achievement_event_received',
      correlationId,
      eventType: event.eventType,
      userId: event.userId,
    });

    try {
      const occurredAt =
        event.eventType === 'badge.earned'
          ? event.awardedAt
          : 'timestamp' in event
            ? event.timestamp
            : new Date();

      await this.userActivityService.recordExternalEvent({
        eventType: event.eventType,
        userId: event.userId,
        metadata: EVENT_METADATA_TRANSFORMERS[event.eventType]?.(event),
        occurredAt,
      });

      this.logger.debug({
        event: 'user_activity_recorded_from_achievement',
        correlationId,
        eventType: event.eventType,
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error({
        event: 'user_activity_recording_from_achievement_failed',
        correlationId,
        eventType: event.eventType,
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
