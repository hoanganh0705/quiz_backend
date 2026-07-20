/**
 * Review Event Listener Adapter
 *
 * Subscribes to Review domain events and dispatches them to the AnalyticsEventHandler.
 * This adapter bridges the Review domain event bus to the Quiz analytics domain.
 *
 * Registered in QuizModule.onModuleInit and unsubscribed on destroy.
 */

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  REVIEW_DOMAIN_EVENT_BUS,
  type PublishedReviewDomainEvent,
  type ReviewDomainEventBusPort,
} from '@/modules/review/domain/events';
import { AnalyticsEventHandler } from '@/modules/quiz/domain/analytics/analytics-event-handler';

@Injectable()
export class ReviewEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Optional()
    @Inject(forwardRef(() => REVIEW_DOMAIN_EVENT_BUS))
    private readonly reviewEventBus: ReviewDomainEventBusPort | null,
    private readonly analyticsEventHandler: AnalyticsEventHandler,
    @InjectPinoLogger(ReviewEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): void {
    if (!this.reviewEventBus) {
      this.logger.warn({
        event: 'review_event_listener_no_bus',
        message: 'REVIEW_DOMAIN_EVENT_BUS not available — review analytics will not be triggered',
      });
      return;
    }

    this.unsubscribe = this.reviewEventBus.subscribe((event: PublishedReviewDomainEvent) => {
      // Phase 4 / Issue #34 — the bus dispatches synchronously and
      // does not await subscriber promises. The previous shape
      // (`void this.handleEvent(event)`) discards the returned
      // promise, so any rejection from `handleEvent` becomes an
      // unhandled rejection outside the bus's try/catch. Capture the
      // promise here and route rejections through the structured
      // logger so they are observable and never escape as
      // `unhandledRejection`. The durable analytics refresh still
      // happens through the outbox worker (`ReviewOutboxProcessorService`),
      // so this listener is a fast-path signal that should never
      // block the HTTP request.
      this.handleEvent(event).catch((error) => {
        this.logger.error({
          event: 'review_event_handler_failed',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    this.logger.info({
      event: 'quiz_review_listener_subscribed',
    });
  }

  private async handleEvent(event: PublishedReviewDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'review.submitted': {
        const quizId = event.payload.quizId;
        await this.analyticsEventHandler.onReviewSubmitted(quizId);
        this.logger.debug({
          event: 'review_submitted_dispatched_to_analytics',
          quizId,
        });
        break;
      }
      case 'review.deleted': {
        const quizId = event.payload.quizId;
        await this.analyticsEventHandler.onReviewDeleted(quizId);
        this.logger.debug({
          event: 'review_deleted_dispatched_to_analytics',
          quizId,
        });
        break;
      }
    }
  }
}
