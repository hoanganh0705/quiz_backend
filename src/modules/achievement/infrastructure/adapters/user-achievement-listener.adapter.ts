/**
 * User Achievement Listener Adapter
 *
 * Subscribes to User domain events and triggers achievement evaluation via
 * the rule engine. Closes the gap where `user.streak_updated` was emitted by
 * `StreakService` but had no consumer in the Achievement module.
 *
 * Hosted in AchievementModule to avoid cross-module import cycles.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEvent,
  type UserStreakUpdatedEvent,
} from '@/modules/user/domain/events';
import { RuleEngineService } from '../../domain/services/rule-engine.service';

@Injectable()
export class UserAchievementListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => USER_DOMAIN_EVENT_BUS))
    private readonly userEventBus: {
      subscribe(handler: (event: UserDomainEvent) => void): () => void;
    },
    private readonly ruleEngineService: RuleEngineService,
    @InjectPinoLogger(UserAchievementListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): void {
    this.unsubscribe = this.userEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'user_achievement_listener_subscribed',
    });
  }

  private async handleEvent(event: UserDomainEvent): Promise<void> {
    if (event.eventType === 'user.streak_updated') {
      await this.handleStreakUpdated(event);
    }
  }

  private async handleStreakUpdated(event: UserStreakUpdatedEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'user.streak_updated',
        eventData: {
          currentStreak: event.currentStreak,
          longestStreak: event.longestStreak,
          previousStreak: event.previousStreak,
          isNewRecord: event.isNewRecord,
        },
      });

      this.logger.info({
        event: 'user_streak_updated_evaluated',
        correlationId,
        userId: event.userId,
        currentStreak: event.currentStreak,
        longestStreak: event.longestStreak,
        isNewRecord: event.isNewRecord,
        badgesAwarded: results.filter((r) => r.awarded).length,
      });
    } catch (error) {
      this.logger.error({
        event: 'user_streak_updated_evaluation_failed',
        correlationId,
        userId: event.userId,
        currentStreak: event.currentStreak,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
