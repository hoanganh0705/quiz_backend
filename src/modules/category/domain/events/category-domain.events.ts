/**
 * Domain event types for the Category aggregate.
 *
 * These events are emitted after successful state transitions in CategoryDomainService.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Implemented as plain object types rather than classes because the
 * {@link CategoryDomainEventBus} forwards the payload argument by reference
 * (`this.emit(event)`), not a class instance. Class-based declarations would
 * be misleading about the runtime shape.
 */
export type CategoryCreatedEvent = {
  type: 'CategoryCreatedEvent';
  categoryId: string;
  slug: string;
  nowIso: string;
};

export type CategoryUpdatedEvent = {
  type: 'CategoryUpdatedEvent';
  categoryId: string;
  slug: string;
  nowIso: string;
};

export type CategoryDeletedEvent = {
  type: 'CategoryDeletedEvent';
  categoryId: string;
  slug: string;
  nowIso: string;
};

export type CategoryRestoredEvent = {
  type: 'CategoryRestoredEvent';
  categoryId: string;
  slug: string;
  nowIso: string;
};

export type CategoryDomainEvent =
  | CategoryCreatedEvent
  | CategoryUpdatedEvent
  | CategoryDeletedEvent
  | CategoryRestoredEvent;
