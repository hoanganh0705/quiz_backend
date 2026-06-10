/**
 * Domain event types for the Category aggregate.
 *
 * These events are emitted after successful state transitions in CategoryDomainService.
 * They are in-process events — listeners are invoked synchronously within the same request.
 */
export class CategoryCreatedEvent {
  constructor(
    public readonly categoryId: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export class CategoryUpdatedEvent {
  constructor(
    public readonly categoryId: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export class CategoryDeletedEvent {
  constructor(
    public readonly categoryId: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export class CategoryRestoredEvent {
  constructor(
    public readonly categoryId: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export type CategoryDomainEvent =
  | CategoryCreatedEvent
  | CategoryUpdatedEvent
  | CategoryDeletedEvent
  | CategoryRestoredEvent;
