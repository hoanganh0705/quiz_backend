/**
 * Ranking Domain Event Bus Implementation
 *
 * Simple in-process event bus using the observer pattern.
 */

import { Injectable } from '@nestjs/common';
import type {
  RankingDomainEventBusPort,
  ExternalEventBusPort,
} from '../../domain/ports/ranking-event-bus.port';
import type {
  XpAddedEvent,
  RankChangedEvent,
  PeakRankAchievedEvent,
  PeriodResetInitiatedEvent,
  PeriodResetCompletedEvent,
  RankingMilestoneEvent,
  ConsistencyCheckEvent,
  ExternalXpEarnedEvent,
} from '../../domain/events/ranking-domain.events';

/**
 * In-memory event bus for ranking domain events.
 */
@Injectable()
export class RankingDomainEventBus implements RankingDomainEventBusPort {
  private handlers: Array<(event: RankingDomainEvent) => void> = [];

  subscribe(handler: (event: RankingDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: RankingDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in ranking event handler:', error);
      }
    }
  }

  emitXpAdded(event: XpAddedEvent): void {
    this.emit(event);
  }

  emitRankChanged(event: RankChangedEvent): void {
    this.emit(event);
  }

  emitPeakRankAchieved(event: PeakRankAchievedEvent): void {
    this.emit(event);
  }

  emitPeriodResetInitiated(event: PeriodResetInitiatedEvent): void {
    this.emit(event);
  }

  emitPeriodResetCompleted(event: PeriodResetCompletedEvent): void {
    this.emit(event);
  }

  emitRankingMilestone(event: RankingMilestoneEvent): void {
    this.emit(event);
  }

  emitConsistencyCheck(event: ConsistencyCheckEvent): void {
    this.emit(event);
  }
}

type RankingDomainEvent =
  | XpAddedEvent
  | RankChangedEvent
  | PeakRankAchievedEvent
  | PeriodResetInitiatedEvent
  | PeriodResetCompletedEvent
  | RankingMilestoneEvent
  | ConsistencyCheckEvent;
