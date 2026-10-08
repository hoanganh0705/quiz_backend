import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AchievementDomainEventBus } from './achievement-domain.event-bus';
import type { AchievementDomainEvent } from './achievement.events';
import {
  SHARED_ACHIEVEMENT_EVENT_BUS,
  type SharedAchievementEventBusPort,
  type SharedAchievementDomainEvent,
  type SharedBadgeEarnedEvent,
  type SharedBadgeRestoredEvent,
  type SharedBadgeRevokedEvent,
} from '@/common/events/achievement-shared-events';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const SHARED_ACHIEVEMENT_FANOUT_TTL_SECONDS = 30;

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
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider | null,
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

  private async forwardToSharedBus(event: AchievementDomainEvent): Promise<void> {
    const sharedEvent = this.toSharedEvent(event);
    if (!sharedEvent) return;

    const fanoutKey = buildAchievementFanoutKey(sharedEvent);
    if (fanoutKey && this.cache) {
      let claimed: boolean;
      try {
        claimed = await this.cache.setIfNotExistsWithTtlSeconds(
          fanoutKey,
          '1',
          SHARED_ACHIEVEMENT_FANOUT_TTL_SECONDS,
        );
      } catch (error) {
        this.logger.warn({
          event: 'shared_achievement_fanout_dedupe_unavailable',
          eventType: sharedEvent.eventType,
          message: error instanceof Error ? error.message : String(error),
        });
        claimed = true;
      }
      if (!claimed) {
        this.logger.debug({
          event: 'shared_achievement_fanout_skipped_duplicate',
          eventType: sharedEvent.eventType,
          fanoutKey,
        });
        return;
      }
    }

    this.dispatchToHandlers(sharedEvent);
  }

  private dispatchToHandlers(event: SharedAchievementDomainEvent): void {
    for (const handler of this.sharedHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'shared_achievement_handler_error',
          eventType: event.eventType,
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

      case 'badge.restored': {
        const shared: SharedBadgeRestoredEvent = {
          eventType: 'badge.restored',
          userId: event.userId,
          badgeId: event.badgeId,
          badgeType: event.badgeType,
          restoredAt: event.restoredAt,
          restoredBy: event.restoredBy,
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

function buildAchievementFanoutKey(event: SharedAchievementDomainEvent): string | null {
  if (typeof event.userId !== 'string') {
    return null;
  }
  return `shared:achievement:fanout:${event.eventType}:${event.userId}`;
}

export { SHARED_ACHIEVEMENT_EVENT_BUS };
