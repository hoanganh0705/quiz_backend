/**
 * Domain event types for the Attempt aggregate.
 *
 * These events are emitted after successful state transitions in the Attempt domain.
 * They are in-process events — listeners are invoked synchronously within the same request.
 *
 * Use the AttemptDomainEventBus to subscribe to these events.
 */

export class AttemptStartedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly quizVersionId: string,
    public readonly contextType: string,
    public readonly contextRefId: string | null,
    public readonly nowIso: string,
  ) {}
}

export class AttemptAnswerSubmittedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly questionId: string,
    public readonly selectedOptionId: string | null,
    public readonly nowIso: string,
  ) {}
}

export class AttemptAbandonedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly nowIso: string,
  ) {}
}

export class AttemptCompletedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly quizVersionId: string,
    public readonly scorePercent: string,
    public readonly correctCount: number,
    public readonly totalQuestions: number,
    public readonly timeTakenMs: number,
    public readonly xpEarned: number,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'attempt.completed' {
    return 'attempt.completed';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

/**
 * Event emitted when a user completes a quiz and may have reached a milestone.
 * Triggers achievement evaluation for quiz count milestones (e.g., 10, 50, 100 quizzes).
 */
export class QuizMilestoneEvent {
  constructor(
    public readonly userId: string,
    public readonly completedCount: number,
    public readonly milestone: number,
    public readonly nowIso: string,
  ) {}

  get eventType(): 'quiz.milestone' {
    return 'quiz.milestone';
  }

  get timestamp(): Date {
    return new Date(this.nowIso);
  }
}

export type AttemptDomainEvent =
  | AttemptStartedEvent
  | AttemptAnswerSubmittedEvent
  | AttemptAbandonedEvent
  | AttemptCompletedEvent
  | QuizMilestoneEvent;
