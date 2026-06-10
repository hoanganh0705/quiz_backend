/**
 * Domain event types for the Bookmark aggregate.
 *
 * These events are emitted after successful state transitions in the Bookmark domain.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use BookmarkDomainEventBus to subscribe to these events.
 */

export class BookmarkAddedEvent {
  constructor(
    public readonly bookmarkId: string,
    public readonly collectionId: string,
    public readonly quizId: string,
    public readonly userId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'bookmark.added' {
    return 'bookmark.added';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export class BookmarkRemovedEvent {
  constructor(
    public readonly bookmarkId: string,
    public readonly collectionId: string,
    public readonly quizId: string,
    public readonly userId: string,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'bookmark.removed' {
    return 'bookmark.removed';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export type BookmarkDomainEvent = BookmarkAddedEvent | BookmarkRemovedEvent;
