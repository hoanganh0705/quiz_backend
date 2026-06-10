/**
 * Ranking Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to ranking domain events.
 */

import type {
  XpAddedEvent,
  RankChangedEvent,
  PeakRankAchievedEvent,
  PeriodResetInitiatedEvent,
  PeriodResetCompletedEvent,
  RankingMilestoneEvent,
  ConsistencyCheckEvent,
} from '../events/ranking-domain.events';

/**
 * Event bus interface for ranking domain.
 */
export interface RankingDomainEventBusPort {
  /**
   * Subscribe to ranking domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: PublishedRankingDomainEvent) => void): () => void;

  /**
   * Publish an XpAdded event.
   */
  emitXpAdded(event: XpAddedEvent): void;

  /**
   * Publish a RankChanged event.
   */
  emitRankChanged(event: RankChangedEvent): void;

  /**
   * Publish a PeakRankAchieved event.
   */
  emitPeakRankAchieved(event: PeakRankAchievedEvent): void;

  /**
   * Publish a PeriodResetInitiated event.
   */
  emitPeriodResetInitiated(event: PeriodResetInitiatedEvent): void;

  /**
   * Publish a PeriodResetCompleted event.
   */
  emitPeriodResetCompleted(event: PeriodResetCompletedEvent): void;

  /**
   * Publish a RankingMilestone event.
   */
  emitRankingMilestone(event: RankingMilestoneEvent): void;

  /**
   * Publish a ConsistencyCheck event.
   */
  emitConsistencyCheck(event: ConsistencyCheckEvent): void;
}

/**
 * Union type of all events that can be published.
 */
export type PublishedRankingDomainEvent =
  | XpAddedEvent
  | RankChangedEvent
  | PeakRankAchievedEvent
  | PeriodResetInitiatedEvent
  | PeriodResetCompletedEvent
  | RankingMilestoneEvent
  | ConsistencyCheckEvent;

export const RANKING_DOMAIN_EVENT_BUS = Symbol('RANKING_DOMAIN_EVENT_BUS');
