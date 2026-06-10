/**
 * Domain event types for the Tag aggregate.
 *
 * These events are emitted after successful state transitions in TagDomainService.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use the TagDomainEventBus to subscribe to these events.
 */
export class TagCreatedEvent {
  readonly eventType = 'tag.created' as const;
  constructor(
    public readonly tagId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export class TagUpdatedEvent {
  readonly eventType = 'tag.updated' as const;
  constructor(
    public readonly tagId: string,
    public readonly nowIso: string,
  ) {}
}

export class TagDeletedEvent {
  readonly eventType = 'tag.deleted' as const;
  constructor(
    public readonly tagId: string,
    public readonly nowIso: string,
  ) {}
}

export class TagRestoredEvent {
  readonly eventType = 'tag.restored' as const;
  constructor(
    public readonly tagId: string,
    public readonly nowIso: string,
  ) {}
}

export class TagFollowedEvent {
  readonly eventType = 'tag.followed' as const;
  constructor(
    public readonly userId: string,
    public readonly tagId: string,
    public readonly followId: string,
    public readonly nowIso: string,
  ) {}
}

export class TagUnfollowedEvent {
  readonly eventType = 'tag.unfollowed' as const;
  constructor(
    public readonly userId: string,
    public readonly tagId: string,
    public readonly nowIso: string,
  ) {}
}

export type TagDomainEvent =
  | TagCreatedEvent
  | TagUpdatedEvent
  | TagDeletedEvent
  | TagRestoredEvent
  | TagFollowedEvent
  | TagUnfollowedEvent;
