/**
 * Notification Ranking Listener Adapter
 *
 * Listens to Ranking domain events and triggers notifications.
 * This adapter bridges the Ranking domain event bus to Notification domain services.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
  type PublishedRankingDomainEvent,
} from '@/modules/ranking';
import { RankNotificationService } from '../../domain/services/rank-notification.service';
import { NOTIFICATION_REPOSITORY_PORT } from '../../domain/ports/notification-ports';
import type { NotificationRepositoryPort } from '../../domain/ports/notification-ports';

@Injectable()
export class RankingListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly rankNotificationService: RankNotificationService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(RankingListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'notification_ranking_listener_subscribed',
    });
  }

  private async handleEvent(event: PublishedRankingDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'rank.changed':
        await this.handleRankChanged(event);
        break;

      case 'ranking.milestone':
        await this.handleRankingMilestone(event);
        break;

      case 'period.reset.completed':
        this.handlePeriodResetCompleted(event);
        break;
    }
  }

  private async handleRankChanged(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'rank.changed' }>,
  ): Promise<void> {
    if (event.previousRank === null) return;

    const improvement = event.previousRank - event.newRank;

    // Get user's threshold preference
    const prefs = await this.notificationRepository.getPreferences(event.userId);
    const threshold = prefs?.rankImprovementThreshold ?? 5;

    if (improvement >= threshold) {
      try {
        await this.rankNotificationService.notifyRankImprovement({
          userId: event.userId,
          previousRank: event.previousRank,
          newRank: event.newRank,
          period: event.period,
          improvement,
        });
      } catch (error) {
        this.logger.error({
          event: 'rank_improvement_notification_failed',
          userId: event.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async handleRankingMilestone(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'ranking.milestone' }>,
  ): Promise<void> {
    try {
      await this.rankNotificationService.notifyRankAchievement({
        userId: event.userId,
        rank: event.rank,
        period: event.period,
        milestone: this.mapMilestone(event.milestoneType),
        percentile: event.percentile,
      });
    } catch (error) {
      this.logger.error({
        event: 'rank_milestone_notification_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handlePeriodResetCompleted(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'period.reset.completed' }>,
  ): void {
    this.logger.debug({
      event: 'period_reset_notification_received',
      period: event.period,
      archivedRecords: event.archivedRecords,
    });
  }

  private mapMilestone(
    milestone: Extract<
      PublishedRankingDomainEvent,
      { eventType: 'ranking.milestone' }
    >['milestoneType'],
  ): 'top10' | 'top100' | 'top1000' | 'rank1' {
    switch (milestone) {
      case 'TOP_1':
        return 'rank1';
      case 'TOP_10':
      case 'TOP_3':
        return 'top10';
      case 'TOP_50':
      case 'TOP_100':
        return 'top100';
      case 'TOP_1000':
      case 'TOP_10000':
      default:
        return 'top1000';
    }
  }
}
