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

import { Injectable } from '@nestjs/common';
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
  private handlers: Set<(event: RankingDomainEvent) => void> = new Set();

  constructor(
    @InjectPinoLogger(RankingDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: (event: RankingDomainEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Dispatch to in-memory subscribers only.
   * Called by the outbox processor to replay persisted events.
   *
   * Iterates over a snapshot of the handler set so that handler
   * additions/removals during dispatch (e.g. listeners unsubscribing
   * themselves in response to an event) do not mutate the iteration
   * target mid-loop.
   */
  dispatchToSubscribers(event: RankingDomainEvent): void {
    const snapshot = Array.from(this.handlers);
    for (const handler of snapshot) {
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
