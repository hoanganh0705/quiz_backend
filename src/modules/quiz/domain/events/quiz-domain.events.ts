/**
 * Domain event types for the Quiz aggregate.
 *
 * These events are emitted after successful state transitions in domain services.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use the QuizDomainEventBus to subscribe to these events.
 */
export class QuizCreatedEvent {
  constructor(
    public readonly quizId: string,
    public readonly creatorId: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}

export class QuizUpdatedEvent {
  constructor(
    public readonly quizId: string,
    public readonly updatedByUserId: string,
    public readonly nowIso: string,
  ) {}
}

export class QuizDeletedEvent {
  constructor(
    public readonly quizId: string,
    public readonly deletedByUserId: string,
    public readonly nowIso: string,
  ) {}
}

export class QuizVersionCreatedEvent {
  constructor(
    public readonly quizVersionId: string,
    public readonly quizId: string,
    public readonly createdByUserId: string,
    public readonly versionNumber: number,
    public readonly nowIso: string,
  ) {}
}

export class QuizVersionPublishedEvent {
  constructor(
    public readonly quizVersionId: string,
    public readonly quizId: string,
    public readonly publishedByUserId: string,
    public readonly versionNumber: number,
    public readonly nowIso: string,
  ) {}
}

export type QuizDomainEvent =
  | QuizCreatedEvent
  | QuizUpdatedEvent
  | QuizDeletedEvent
  | QuizVersionCreatedEvent
  | QuizVersionPublishedEvent;
