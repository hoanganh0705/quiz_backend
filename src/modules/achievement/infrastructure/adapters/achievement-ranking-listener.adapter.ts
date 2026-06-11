/**
 * Achievement Ranking Listener Adapter
 *
 * Listens to Ranking domain events and triggers achievement evaluation.
 * This adapter bridges the Ranking domain event bus to Achievement domain services.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../../../ranking/domain/ports/ranking-event-bus.port';
import { RankAchievementService } from '../../domain/services/rank-achievement.service';

@Injectable()
export class AchievementRankingListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly rankAchievementService: RankAchievementService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(AchievementRankingListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.eventBus.subscribe(this.handleEvent.bind(this));
    this.logger.info({
      event: 'achievement_ranking_listener_subscribed',
    });
  }

  private async handleEvent(event: { eventType: string; [key: string]: unknown }): Promise<void> {
    switch (event.eventType) {
      case 'rank.changed':
        await this.handleRankChanged(
          event as {
            eventType: 'rank.changed';
            userId: string;
            period: string;
            newRank: number;
            previousRank: number | null;
          },
        );
        break;

      case 'peak.rank.achieved':
        await this.handlePeakRankAchieved(
          event as {
            eventType: 'peak.rank.achieved';
            userId: string;
            period: string;
            newPeakRank: number;
          },
        );
        break;
    }
  }

  private async handleRankChanged(event: {
    eventType: 'rank.changed';
    userId: string;
    period: string;
    newRank: number;
    previousRank: number | null;
  }): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newRank,
        previousRank: event.previousRank,
        xp: 0,
      });
    } catch (error) {
      this.logger.error({
        event: 'rank_achievement_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handlePeakRankAchieved(event: {
    eventType: 'peak.rank.achieved';
    userId: string;
    period: string;
    newPeakRank: number;
  }): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newPeakRank,
        previousRank: null,
        xp: 0,
      });
    } catch (error) {
      this.logger.error({
        event: 'peak_rank_achievement_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
