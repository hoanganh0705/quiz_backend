/**
 * Review Domain Event Bus
 *
 * Simple in-process event bus for Review domain events.
 * Events are dispatched synchronously to all subscribers within the same request.
 *
 * Used by ReviewService to emit review lifecycle events (submitted, deleted).
 * Consumed by Quiz module via AnalyticsEventHandler to refresh review metrics.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  ReviewDomainEventBusPort,
  PublishedReviewDomainEvent,
} from './review-domain-event-bus.port';

@Injectable()
export class ReviewDomainEventBus implements ReviewDomainEventBusPort {
  private handlers: Array<(event: PublishedReviewDomainEvent) => void> = [];

  constructor(
    @InjectPinoLogger(ReviewDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: (event: PublishedReviewDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  dispatchToSubscribers(event: PublishedReviewDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'review_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
