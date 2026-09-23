import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import {
  type BookmarkDomainEventBusPort,
  type BookmarkEventHandler,
  BOOKMARK_DOMAIN_EVENT_BUS,
} from './bookmark-domain-event-bus.port';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './bookmark-domain.events';

export type BookmarkDomainEvent = BookmarkAddedEvent | BookmarkRemovedEvent;

@Injectable()
export class BookmarkDomainEventBus
  extends BaseDomainEventBus<unknown>
  implements BookmarkDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(BookmarkDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'bookmark_event' });
  }

  subscribe(handler: BookmarkEventHandler): () => void {
    return super.subscribe(handler as never);
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
    this.dispatch(event);
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
    this.dispatch(event);
  }
}

export { BOOKMARK_DOMAIN_EVENT_BUS };
