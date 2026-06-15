/**
 * Ranking Event Achievement Listener Adapter
 *
 * Listens to Ranking domain events and triggers achievement evaluation.
 * Subscribes to SHARED_RANKING_EVENT_BUS for cross-module events.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import { SHARED_RANKING_EVENT_BUS } from '@/common/events/ranking-shared-events';
import type {
  SharedRankingEventBusPort,
  SharedRankingDomainEvent,
} from '@/common/events/ranking-shared-events';
import { RankAchievementService } from '../../domain/services/rank-achievement.service';
import { RuleEngineService } from '../../domain/services/rule-engine.service';

@Injectable()
export class RankingEventAchievementListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly rankAchievementService: RankAchievementService,
    private readonly ruleEngineService: RuleEngineService,
    @Inject(SHARED_RANKING_EVENT_BUS)
    private readonly eventBus: SharedRankingEventBusPort,
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
    this.unsubscribe = this.eventBus.subscribe((event: SharedRankingDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'achievement_ranking_listener_subscribed',
    });
  }

  private async handleEvent(event: SharedRankingDomainEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

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
    event: Extract<SharedRankingDomainEvent, { eventType: 'rank.changed' }>,
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
    event: Extract<SharedRankingDomainEvent, { eventType: 'peak.rank.achieved' }>,
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

  private async handleRankingMilestone(
    event: Extract<SharedRankingDomainEvent, { eventType: 'ranking.milestone' }>,
    correlationId: string,
  ): Promise<void> {
    try {
      // Evaluate rank badges through the rank service first (top-10/top-100/top-1000 style).
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.rank,
        previousRank: null,
        xp: 0,
      });

      // Then evaluate rule-engine badges keyed off `ranking.milestone` so any custom
      // rules tied to this trigger can fire (e.g. "reached top-100 in your first
      // active week").
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'ranking.milestone',
        eventData: {
          period: event.period,
          milestoneType: event.milestoneType,
          rank: event.rank,
          percentile: event.percentile,
        },
      });

      this.logger.info({
        event: 'ranking_milestone_evaluated',
        correlationId,
        userId: event.userId,
        period: event.period,
        milestoneType: event.milestoneType,
        rank: event.rank,
        badgesAwarded: results.filter((r) => r.awarded).length,
      });
    } catch (error) {
      this.logger.error({
        event: 'ranking_milestone_evaluation_failed',
        correlationId,
        userId: event.userId,
        period: event.period,
        milestoneType: event.milestoneType,
        rank: event.rank,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
