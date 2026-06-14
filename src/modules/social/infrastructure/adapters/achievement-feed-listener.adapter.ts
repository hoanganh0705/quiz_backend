import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SHARED_ACHIEVEMENT_EVENT_BUS,
  type SharedAchievementEventBusPort,
  type SharedAchievementDomainEvent,
} from '@/common/events/achievement-shared-events';
import { SocialService } from '../../domain/services/social.service';

@Injectable()
export class AchievementFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(SHARED_ACHIEVEMENT_EVENT_BUS)
    private readonly achievementEventBus: SharedAchievementEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(AchievementFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.achievementEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'achievement_feed_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: SharedAchievementDomainEvent): Promise<void> {
    if (event.eventType === 'badge.earned') {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'badge_earned',
        occurredAt: event.awardedAt.toISOString(),
        payload: {
          badgeType: event.badgeType,
        },
      });
      return;
    }

    if (event.eventType === 'badge.revoked') {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'badge_revoked',
        occurredAt: event.revokedAt.toISOString(),
        payload: {
          badgeId: event.badgeId,
          badgeType: event.badgeType,
          reason: event.reason,
          revokedBy: event.revokedBy,
        },
      });
    }
  }
}
