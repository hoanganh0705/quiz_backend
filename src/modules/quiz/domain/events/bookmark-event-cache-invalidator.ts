import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  BOOKMARK_DOMAIN_EVENT_BUS,
  type BookmarkDomainEventBusPort,
} from '@/modules/bookmark/domain/events/bookmark-domain-event-bus.port';
import {
  BookmarkAddedEvent,
  BookmarkRemovedEvent,
} from '@/modules/bookmark/domain/events/bookmark-domain.events';
import { QUIZ_ANALYTICS_PORT, type QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';

@Injectable()
export class BookmarkEventCacheInvalidator implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => BOOKMARK_DOMAIN_EVENT_BUS))
    private readonly bookmarkEventBus: BookmarkDomainEventBusPort,
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalytics: QuizAnalyticsPort,
    @InjectPinoLogger(BookmarkEventCacheInvalidator.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.bookmarkEventBus.subscribe((event: unknown) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: unknown): Promise<void> {
    let quizId: string | null = null;
    let eventType: string | null = null;

    if (event instanceof BookmarkAddedEvent) {
      quizId = event.quizId;
      eventType = event.eventType;
    } else if (event instanceof BookmarkRemovedEvent) {
      quizId = event.quizId;
      eventType = event.eventType;
    }

    if (quizId === null || eventType === null) {
      return;
    }

    try {
      await this.quizAnalytics.invalidateQuizMetrics(quizId);
      this.logger.debug({
        event: 'bookmark_event_cache_invalidated',
        eventType,
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'bookmark_event_cache_invalidation_failed',
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
