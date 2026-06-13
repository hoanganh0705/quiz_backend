/**
 * Shared Ranking Event Bus Adapter
 *
 * Bridges the internal RankingDomainEventBus to the shared ranking event bus port.
 * Re-exports Ranking domain events as SharedRankingDomainEvent types so that
 * external consumers (Achievement, Social) receive well-defined, stable types
 * rather than depending on Ranking module internals.
 *
 * This adapter subscribes to the internal bus and re-emits events on the shared bus.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RankingDomainEventBus } from '../events/ranking-domain.event-bus';
import type {
  RankingDomainEventBusPort,
  PublishedRankingDomainEvent,
} from '../ports/ranking-event-bus.port';
import {
  SHARED_RANKING_EVENT_BUS,
  type SharedRankingEventBusPort,
  type SharedRankingDomainEvent,
} from '@/common/events/ranking-shared-events';

@Injectable()
export class SharedRankingEventBusAdapter
  implements SharedRankingEventBusPort, OnModuleInit, OnModuleDestroy
{
  private sharedHandlers: Array<(event: SharedRankingDomainEvent) => void> = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly internalBus: RankingDomainEventBus,
    @InjectPinoLogger(SharedRankingEventBusAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.internalBus.subscribe((event) => {
      void this.forwardToSharedBus(event as PublishedRankingDomainEvent);
    });

    this.logger.info({
      event: 'shared_ranking_event_bus_adapter_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  subscribe(handler: (event: SharedRankingDomainEvent) => void): () => void {
    this.sharedHandlers.push(handler);
    return () => {
      const index = this.sharedHandlers.indexOf(handler);
      if (index !== -1) {
        this.sharedHandlers.splice(index, 1);
      }
    };
  }

  private forwardToSharedBus(event: PublishedRankingDomainEvent): void {
    const sharedEvent = this.toSharedEvent(event);
    if (!sharedEvent) return;

    for (const handler of this.sharedHandlers) {
      try {
        handler(sharedEvent);
      } catch (error) {
        this.logger.error({
          event: 'shared_ranking_handler_error',
          eventType: sharedEvent.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private toSharedEvent(
    event: PublishedRankingDomainEvent,
  ): SharedRankingDomainEvent | null {
    switch (event.eventType) {
      case 'rank.changed':
        return {
          eventType: 'rank.changed',
          userId: event.userId,
          period: event.period,
          previousRank: event.previousRank,
          newRank: event.newRank,
          previousXp: event.previousXp,
          newXp: event.newXp,
          timestamp: event.timestamp,
        };

      case 'peak.rank.achieved':
        return {
          eventType: 'peak.rank.achieved',
          userId: event.userId,
          period: event.period,
          previousPeakRank: event.previousPeakRank,
          newPeakRank: event.newPeakRank,
          timestamp: event.timestamp,
        };

      case 'ranking.milestone':
        return {
          eventType: 'ranking.milestone',
          userId: event.userId,
          period: event.period,
          milestoneType: event.milestoneType,
          rank: event.rank,
          percentile: event.percentile,
          timestamp: event.timestamp,
        };

      default:
        return null;
    }
  }
}
