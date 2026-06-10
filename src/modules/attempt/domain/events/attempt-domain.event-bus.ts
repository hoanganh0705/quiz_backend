import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type AttemptDomainEventBusPort,
  type AttemptEventHandler,
  ATTEMPT_DOMAIN_EVENT_BUS,
} from './attempt-domain-event-bus.port';
import {
  AttemptStartedEvent,
  AttemptAnswerSubmittedEvent,
  AttemptAbandonedEvent,
  AttemptCompletedEvent,
  QuizMilestoneEvent,
} from './attempt-domain.events';

/**
 * Simple domain event bus for Attempt aggregate events.
 *
 * This is a lightweight in-process event bus using the observer pattern.
 * Events are dispatched synchronously within the same request lifecycle.
 *
 * Use `emit()` to dispatch events and `subscribe()` to register handlers.
 */
@Injectable()
export class AttemptDomainEventBus implements AttemptDomainEventBusPort {
  private handlers: AttemptEventHandler[] = [];

  constructor(
    @InjectPinoLogger(AttemptDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: AttemptEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  emit(event: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'attempt_event_handler_error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  emitAttemptStarted(event: AttemptStartedEvent): void {
    this.logger.debug({
      event: 'attempt_event_emitted',
      eventType: 'attempt.started',
      attemptId: event.attemptId,
    });
    this.emit(event);
  }

  emitAttemptAnswerSubmitted(event: AttemptAnswerSubmittedEvent): void {
    this.logger.debug({
      event: 'attempt_event_emitted',
      eventType: 'attempt.answer_submitted',
      attemptId: event.attemptId,
    });
    this.emit(event);
  }

  emitAttemptAbandoned(event: AttemptAbandonedEvent): void {
    this.logger.debug({
      event: 'attempt_event_emitted',
      eventType: 'attempt.abandoned',
      attemptId: event.attemptId,
    });
    this.emit(event);
  }

  emitAttemptCompleted(event: AttemptCompletedEvent): void {
    this.logger.debug({
      event: 'attempt_event_emitted',
      eventType: 'attempt.completed',
      attemptId: event.attemptId,
      userId: event.userId,
      quizId: event.quizId,
    });
    this.emit(event);
  }

  emitQuizMilestone(event: QuizMilestoneEvent): void {
    this.logger.debug({
      event: 'attempt_event_emitted',
      eventType: 'quiz.milestone',
      userId: event.userId,
      completedCount: event.completedCount,
      milestone: event.milestone,
    });
    this.emit(event);
  }
}

export { ATTEMPT_DOMAIN_EVENT_BUS };
