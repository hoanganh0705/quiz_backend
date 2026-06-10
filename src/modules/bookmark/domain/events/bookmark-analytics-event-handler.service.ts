import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QUIZ_ANALYTICS_PORT } from '@/modules/quiz/domain/analytics';
import type { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import { BOOKMARK_DOMAIN_EVENT_BUS } from './bookmark-domain-event-bus.port';
import type { BookmarkDomainEventBusPort } from './bookmark-domain-event-bus.port';
import {
  BookmarkAddedEvent,
  BookmarkRemovedEvent,
} from './bookmark-domain.events';

/**
 * Subscribes to Bookmark domain events and refreshes quiz analytics accordingly.
 *
 * This bridges Bookmark domain events into the Quiz analytics layer, replacing
 * the previous direct coupling where BookmarkService injected AnalyticsEventHandler.
 *
 * Registered in `BookmarkModule.onModuleInit`.
 */
@Injectable()
export class BookmarkAnalyticsEventHandler implements OnModuleInit {
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
    this.unsubscribe = this.eventBus.subscribe(
      this.handleBookmarkEvent.bind(this),
    );

    this.logger.info({
      event: 'bookmark_analytics_event_handler_subscribed',
    });
  }

  private handleBookmarkEvent(event: unknown): void {
    if (event instanceof BookmarkAddedEvent) {
      void this.refreshBookmarkMetrics(event.quizId);
    } else if (event instanceof BookmarkRemovedEvent) {
      void this.refreshBookmarkMetrics(event.quizId);
    }
  }

  private async refreshBookmarkMetrics(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshBookmarkMetrics(quizId);
      this.logger.debug({
        event: 'bookmark_analytics_refreshed',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'bookmark_analytics_refresh_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
