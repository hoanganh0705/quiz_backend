import type {
  BookmarkAddedEvent,
  BookmarkRemovedEvent,
} from './bookmark-domain.events';

export const BOOKMARK_DOMAIN_EVENT_BUS = Symbol('BOOKMARK_DOMAIN_EVENT_BUS');

export type BookmarkEventHandler = (event: unknown) => void;

export interface BookmarkDomainEventBusPort {
  subscribe(handler: BookmarkEventHandler): () => void;

  emitBookmarkAdded(event: BookmarkAddedEvent): void;
  emitBookmarkRemoved(event: BookmarkRemovedEvent): void;
}
