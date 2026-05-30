/**
 * Achievement Application Service
 *
 * Subscribes to Ranking domain events and triggers achievement evaluation.
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ConsistencyService, RankAchievementService } from '../domain/services';
import { RANKING_DOMAIN_EVENT_BUS } from '@/modules/ranking';
import type { PublishedRankingDomainEvent, RankingDomainEventBusPort } from '@/modules/ranking';

@Injectable()
export class AchievementApplicationService implements OnModuleInit {
  constructor(
    private readonly rankAchievementService: RankAchievementService,
    private readonly consistencyService: ConsistencyService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(AchievementApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribeToRankingEvents();
  }

  private subscribeToRankingEvents(): void {
    this.eventBus.subscribe((event) => {
      void this.handleRankingEvent(event);
    });

    this.logger.info({
      event: 'achievement_application_service_subscribed',
    });
  }

  private async handleRankingEvent(event: PublishedRankingDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'rank.changed':
        await this.handleRankChanged(event);
        break;

      case 'xp.added':
        await this.handleXpAdded(event);
        break;

      case 'peak.rank.achieved':
        await this.handlePeakRankAchieved(event);
        break;

      case 'ranking.milestone':
        this.handleRankingMilestone(event);
        break;
    }
  }

  private async handleRankChanged(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'rank.changed' }>,
  ): Promise<void> {
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
        event: 'rank_achievement_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleXpAdded(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'xp.added' }>,
  ): Promise<void> {
    try {
      await this.consistencyService.awardConsistencyBadge({
        userId: event.userId,
        streakDays: 1,
      });
    } catch (error) {
      this.logger.error({
        event: 'consistency_badge_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handlePeakRankAchieved(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'peak.rank.achieved' }>,
  ): Promise<void> {
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
        event: 'peak_rank_achievement_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleRankingMilestone(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'ranking.milestone' }>,
  ): void {
    this.logger.debug({
      event: 'ranking_milestone_received',
      userId: event.userId,
      milestoneType: event.milestoneType,
      rank: event.rank,
    });
  }
}
