import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type BookmarkDomainEventBusPort,
  type BookmarkEventHandler,
  BOOKMARK_DOMAIN_EVENT_BUS,
} from './bookmark-domain-event-bus.port';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './bookmark-domain.events';

/**
 * Simple domain event bus for Bookmark aggregate events.
 *
 * This is a lightweight in-process event bus using the observer pattern.
 * Events are dispatched synchronously within the same request lifecycle.
 *
 * Use `emit()` to dispatch events and `subscribe()` to register handlers.
 */
@Injectable()
export class BookmarkDomainEventBus implements BookmarkDomainEventBusPort {
  private handlers: BookmarkEventHandler[] = [];

  constructor(
    @InjectPinoLogger(BookmarkDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: BookmarkEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'bookmark_event_handler_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  emitBookmarkAdded(event: BookmarkAddedEvent): void {
    this.logger.debug({
      event: 'bookmark_event_emitted',
      eventType: 'bookmark.added',
      bookmarkId: event.bookmarkId,
      collectionId: event.collectionId,
      quizId: event.quizId,
      userId: event.userId,
    });
    this.emit(event);
  }

  emitBookmarkRemoved(event: BookmarkRemovedEvent): void {
    this.logger.debug({
      event: 'bookmark_event_emitted',
      eventType: 'bookmark.removed',
      bookmarkId: event.bookmarkId,
      collectionId: event.collectionId,
      quizId: event.quizId,
      userId: event.userId,
    });
    this.emit(event);
  }
}

export { BOOKMARK_DOMAIN_EVENT_BUS };
