import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QUIZ_ANALYTICS_PORT } from '@/modules/quiz/domain/analytics';
import type { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import { BOOKMARK_DOMAIN_EVENT_BUS } from './bookmark-domain-event-bus.port';
import type { BookmarkDomainEventBusPort } from './bookmark-domain-event-bus.port';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './bookmark-domain.events';

/**
 * Subscribes to Bookmark domain events and refreshes quiz analytics accordingly.
 *
 * This bridges Bookmark domain events into the Quiz analytics layer, replacing
 * the previous direct coupling where BookmarkService injected AnalyticsEventHandler.
 *
 * Registered in `BookmarkModule.onModuleInit`.
 */
@Injectable()
export class BookmarkAnalyticsEventHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(BOOKMARK_DOMAIN_EVENT_BUS)
    private readonly eventBus: BookmarkDomainEventBusPort,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(BookmarkAnalyticsEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe(this.handleBookmarkEvent.bind(this));

    this.logger.info({
      event: 'bookmark_analytics_event_handler_subscribed',
    });
  }

  onModuleDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      this.logger.info({
        event: 'bookmark_analytics_event_handler_unsubscribed',
      });
    }
  }

  private handleBookmarkEvent(event: unknown): void {
    if (event instanceof BookmarkAddedEvent) {
      void this.recomputeBookmarkCount(event.quizId);
    } else if (event instanceof BookmarkRemovedEvent) {
      void this.recomputeBookmarkCount(event.quizId);
    }
  }

  private async recomputeBookmarkCount(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.recomputeBookmarkCount(quizId);
      this.logger.debug({
        event: 'bookmark_count_recomputed',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'bookmark_count_recompute_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
