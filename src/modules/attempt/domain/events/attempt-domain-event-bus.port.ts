import type {
  AttemptStartedEvent,
  AttemptAnswerSubmittedEvent,
  AttemptAbandonedEvent,
  AttemptCompletedEvent,
  QuizMilestoneEvent,
} from '../events/attempt-domain.events';

export const ATTEMPT_DOMAIN_EVENT_BUS = Symbol('ATTEMPT_DOMAIN_EVENT_BUS');

export type AttemptEventHandler = (event: unknown) => void;

export interface AttemptDomainEventBusPort {
  subscribe(handler: AttemptEventHandler): () => void;

  emitAttemptStarted(event: AttemptStartedEvent): void;
  emitAttemptAnswerSubmitted(event: AttemptAnswerSubmittedEvent): void;
  emitAttemptAbandoned(event: AttemptAbandonedEvent): void;
  emitAttemptCompleted(event: AttemptCompletedEvent): void;
  emitQuizMilestone(event: QuizMilestoneEvent): void;
}
