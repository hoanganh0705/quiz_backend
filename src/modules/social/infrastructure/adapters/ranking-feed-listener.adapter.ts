import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type PublishedRankingDomainEvent,
  type RankingDomainEventBusPort,
} from '@/modules/ranking/domain/ports/ranking-event-bus.port';
import { SocialService } from '../../domain/services/social.service';

@Injectable()
export class RankingFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly rankingEventBus: RankingDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(RankingFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.rankingEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: PublishedRankingDomainEvent): Promise<void> {
    if (event.eventType === 'ranking.milestone') {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'rank_milestone',
        occurredAt: event.timestamp.toISOString(),
        payload: {
          period: event.period,
          milestoneType: event.milestoneType,
          rank: event.rank,
          percentile: event.percentile,
        },
      });
      return;
    }

    if (event.eventType === 'peak.rank.achieved') {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'peak_rank_achieved',
        occurredAt: event.timestamp.toISOString(),
        payload: {
          period: event.period,
          previousPeakRank: event.previousPeakRank,
          newPeakRank: event.newPeakRank,
        },
      });
    }
  }
}
