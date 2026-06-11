/**
 * Ranking Domain Event Bus Implementation
 *
 * Publishes events via two mechanisms:
 *
 * 1. In-memory dispatch: immediate delivery to local subscribers
 *    (notification listeners, consistency subscriber, etc.)
 *
 * 2. Outbox persist: every event is also written to the outbox_events table
 *    in the same DB transaction as the domain write that triggered it.
 *    The RankingOutboxProcessor reads pending rows and dispatches them,
 *    with retry and DLQ support for failed handlers.
 *
 * This dual-write guarantees:
 *   - Real-time subscribers get events immediately (in-memory)
 *   - Failed handlers are retried with exponential backoff
 *   - Events survive process crashes (recovered from the outbox on restart)
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  XpAddedEvent,
  RankChangedEvent,
  PeakRankAchievedEvent,
  PeriodResetInitiatedEvent,
  PeriodResetCompletedEvent,
  RankingMilestoneEvent,
  ConsistencyCheckEvent,
} from './ranking-domain.events';
import { RankingDomainEventBusPort } from '../ports';
import type { RankingOutboxPort } from '../ports/ranking-outbox.port';

type RankingDomainEvent =
  | XpAddedEvent
  | RankChangedEvent
  | PeakRankAchievedEvent
  | PeriodResetInitiatedEvent
  | PeriodResetCompletedEvent
  | RankingMilestoneEvent
  | ConsistencyCheckEvent;

@Injectable()
export class RankingDomainEventBus implements RankingDomainEventBusPort {
  private handlers: Array<(event: RankingDomainEvent) => void> = [];

  constructor(
    @InjectPinoLogger(RankingDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: (event: RankingDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Dispatch to in-memory subscribers only.
   * Called by the outbox processor to replay persisted events.
   */
  dispatchToSubscribers(event: RankingDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'ranking_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  emitXpAdded(event: XpAddedEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitRankChanged(event: RankChangedEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitPeakRankAchieved(event: PeakRankAchievedEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitPeriodResetInitiated(event: PeriodResetInitiatedEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitPeriodResetCompleted(event: PeriodResetCompletedEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitRankingMilestone(event: RankingMilestoneEvent): void {
    this.dispatchToSubscribers(event);
  }

  emitConsistencyCheck(event: ConsistencyCheckEvent): void {
    this.dispatchToSubscribers(event);
  }
}
