/**
 * Ranking Event Achievement Listener Adapter
 *
 * Listens to Ranking domain events and triggers achievement evaluation.
 * This adapter bridges the Ranking domain event bus to Achievement domain services.
 *
 * Subscribes directly to the internal RankingDomainEventBus since both run in
 * the same process — no need for an intermediate adapter. Cross-module consumers
 * in separate processes should use SharedRankingEventBusAdapter + SHARED_RANKING_EVENT_BUS.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '@/modules/ranking';
import type { PublishedRankingDomainEvent } from '@/modules/ranking';
import { RankAchievementService } from '../../domain/services/rank-achievement.service';

@Injectable()
export class RankingEventAchievementListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly rankAchievementService: RankAchievementService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(RankingEventAchievementListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.eventBus.subscribe((event: PublishedRankingDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'achievement_ranking_listener_subscribed',
    });
  }

  private async handleEvent(event: PublishedRankingDomainEvent): Promise<void> {
    const correlationId = createCorrelationId();

    switch (event.eventType) {
      case 'rank.changed':
        await this.handleRankChanged(event, correlationId);
        break;

      case 'peak.rank.achieved':
        await this.handlePeakRankAchieved(event, correlationId);
        break;

      case 'ranking.milestone':
        this.handleRankingMilestone(event, correlationId);
        break;
    }
  }

  private async handleRankChanged(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'rank.changed' }>,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newRank,
        previousRank: event.previousRank,
        xp: 0,
      });

      this.logger.info({
        event: 'rank_achievement_evaluation_succeeded',
        correlationId,
        userId: event.userId,
        period: event.period,
        newRank: event.newRank,
        previousRank: event.previousRank,
      });
    } catch (error) {
      this.logger.error({
        event: 'rank_achievement_evaluation_failed',
        correlationId,
        userId: event.userId,
        period: event.period,
        newRank: event.newRank,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handlePeakRankAchieved(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'peak.rank.achieved' }>,
    correlationId: string,
  ): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newPeakRank,
        previousRank: null,
        xp: 0,
      });

      this.logger.info({
        event: 'peak_rank_achievement_evaluation_succeeded',
        correlationId,
        userId: event.userId,
        period: event.period,
        newPeakRank: event.newPeakRank,
      });
    } catch (error) {
      this.logger.error({
        event: 'peak_rank_achievement_evaluation_failed',
        correlationId,
        userId: event.userId,
        period: event.period,
        newPeakRank: event.newPeakRank,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleRankingMilestone(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'ranking.milestone' }>,
    correlationId: string,
  ): void {
    this.logger.debug({
      event: 'ranking_milestone_received',
      correlationId,
      userId: event.userId,
      period: event.period,
      milestoneType: event.milestoneType,
      rank: event.rank,
    });
  }
}
