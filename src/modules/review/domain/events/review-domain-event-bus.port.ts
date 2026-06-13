/**
 * Review Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to review domain events.
 * Used by the Review module to emit events and by external consumers
 * (e.g. Quiz module) to subscribe.
 */

import type {
  ReviewSubmittedEvent,
  ReviewDeletedEvent,
} from './review-domain.events';

export const REVIEW_DOMAIN_EVENT_BUS = Symbol('REVIEW_DOMAIN_EVENT_BUS');

/**
 * Event bus interface for the Review domain.
 */
export interface ReviewDomainEventBusPort {
  /**
   * Subscribe to review domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: PublishedReviewDomainEvent) => void): () => void;

  /**
   * Dispatch to in-memory subscribers only.
   * Called by ReviewService to publish events.
   */
  dispatchToSubscribers(event: PublishedReviewDomainEvent): void;
}

/**
 * Union type of all events that can be published.
 */
export type PublishedReviewDomainEvent = ReviewSubmittedEvent | ReviewDeletedEvent;
