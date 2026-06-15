/**
 * Ranking Period Reset Notification Adapter
 *
 * Subscribes to RankingDomainEventBus for period reset events and notifies
 * affected top-ranked users. This bridges the Ranking domain to the Notification
 * domain for period lifecycle events.
 *
 * Handles:
 * - `period.reset.initiated`: Logs reset initiation details
 * - `period.reset.completed`: Logs reset completion details
 *
 * Only top-ranked users (rank <= 100) receive notifications to avoid
 * sending bulk notifications to the entire user base.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../../domain/ports/ranking-event-bus.port';
import type {
  PeriodResetInitiatedEvent,
  PeriodResetCompletedEvent,
} from '../../domain/events/ranking-domain.events';
import { RankingPeriod } from '../../domain/types/ranking.types';
import { NotificationChannelService } from '@/modules/notification/infrastructure/adapters/notification-channel.service';

type PeriodResetEvent = PeriodResetInitiatedEvent | PeriodResetCompletedEvent;

@Injectable()
export class RankingPeriodResetNotificationAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(RankingPeriodResetNotificationAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'ranking_period_reset_notification_adapter_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: unknown): Promise<void> {
    if (!this.isPeriodResetEvent(event)) return;

    switch (event.eventType) {
      case 'period.reset.initiated':
        await this.handleResetInitiated(event);
        break;
      case 'period.reset.completed':
        await this.handleResetCompleted(event);
        break;
    }
  }

  private isPeriodResetEvent(event: unknown): event is PeriodResetEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event.eventType === 'period.reset.initiated' || event.eventType === 'period.reset.completed')
    );
  }

  private async handleResetInitiated(event: PeriodResetInitiatedEvent): Promise<void> {
    const periodLabel = this.formatPeriodLabel(event.period);

    this.logger.info({
      event: 'period_reset_initiated_notification',
      period: event.period,
      periodLabel,
      usersAffected: event.usersAffected,
      resetAt: event.resetAt,
    });
  }

  private async handleResetCompleted(event: PeriodResetCompletedEvent): Promise<void> {
    const periodLabel = this.formatPeriodLabel(event.period);

    this.logger.info({
      event: 'period_reset_completed_notification',
      period: event.period,
      periodLabel,
      archivedRecords: event.archivedRecords,
      newPeriodStart: event.newPeriodStart,
    });
  }

  private formatPeriodLabel(period: RankingPeriod): string {
    switch (period) {
      case RankingPeriod.DAILY:
        return 'Daily';
      case RankingPeriod.WEEKLY:
        return 'Weekly';
      case RankingPeriod.MONTHLY:
        return 'Monthly';
      case RankingPeriod.ALL_TIME:
        return 'All-Time';
      default:
        return String(period);
    }
  }
}
