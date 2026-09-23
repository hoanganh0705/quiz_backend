import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  REVIEW_DOMAIN_EVENT_BUS,
  type PublishedReviewDomainEvent,
  type ReviewDomainEventBusPort,
} from '@/modules/review/domain/events';
import { QUIZ_ANALYTICS_PORT, type QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';

@Injectable()
export class ReviewEventCacheInvalidator implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => REVIEW_DOMAIN_EVENT_BUS))
    private readonly reviewEventBus: ReviewDomainEventBusPort,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalytics: QuizAnalyticsPort,
    @InjectPinoLogger(ReviewEventCacheInvalidator.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.reviewEventBus.subscribe((event: PublishedReviewDomainEvent) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: PublishedReviewDomainEvent): Promise<void> {
    try {
      const quizId = event.payload.quizId;
      await this.quizAnalytics.invalidateQuizMetrics(quizId);
      this.logger.debug({
        event: 'review_event_cache_invalidated',
        eventType: event.eventType,
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'review_event_cache_invalidation_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
