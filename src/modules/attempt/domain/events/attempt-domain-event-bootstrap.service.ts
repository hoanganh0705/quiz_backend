import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ATTEMPT_DOMAIN_EVENT_BUS, type AttemptEventHandler } from './attempt-domain-event-bus.port';
import type { AttemptDomainEventBusPort } from './attempt-domain-event-bus.port';
import {
  AttemptStartedEvent,
  AttemptAnswerSubmittedEvent,
  AttemptAbandonedEvent,
  AttemptCompletedEvent,
} from './attempt-domain.events';

/**
 * Bootstraps in-process event subscriptions between the Attempt domain event bus
 * and downstream handlers in other modules (analytics, ranking, social, notification).
 *
 * All subscriptions are registered once in `onModuleInit`. Handlers run
 * synchronously within the same request lifecycle — keep them fast and
 * fault-tolerant (errors are caught and logged by AttemptDomainEventBus).
 *
 * **Note:** This service intentionally does NOT subscribe to AttemptCompletedEvent
 * for analytics refresh. The Quiz module owns `QuizAttemptEventHandler` which
 * subscribes to `AttemptCompletedEvent` via its own bootstrap service.
 * See `src/modules/quiz/domain/events/quiz-attempt-event-handler.service.ts`.
 */
@Injectable()
export class AttemptDomainEventBootstrapService implements OnModuleInit {
  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly eventBus: AttemptDomainEventBusPort,
    @InjectPinoLogger(AttemptDomainEventBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  private readonly unsubscribers: Array<() => void> = [];

  onModuleInit(): void {
    this.subscribe(this.handleAttemptStarted.bind(this));
    this.subscribe(this.handleAttemptAnswerSubmitted.bind(this));
    this.subscribe(this.handleAttemptAbandoned.bind(this));

    this.logger.info({ event: 'attempt_event_subscriptions_initialized' });
  }

  private subscribe(handler: AttemptEventHandler): void {
    this.unsubscribers.push(this.eventBus.subscribe(handler));
  }

  private handleAttemptStarted(event: unknown): void {
    if (!(event instanceof AttemptStartedEvent)) return;

    this.logger.debug({
      event: 'attempt_started_event_received',
      attemptId: event.attemptId,
      userId: event.userId,
      quizId: event.quizId,
    });
  }

  private handleAttemptAnswerSubmitted(event: unknown): void {
    if (!(event instanceof AttemptAnswerSubmittedEvent)) return;

    this.logger.debug({
      event: 'attempt_answer_submitted_event_received',
      attemptId: event.attemptId,
      userId: event.userId,
      questionId: event.questionId,
    });
  }

  private handleAttemptAbandoned(event: unknown): void {
    if (!(event instanceof AttemptAbandonedEvent)) return;

    this.logger.debug({
      event: 'attempt_abandoned_event_received',
      attemptId: event.attemptId,
      userId: event.userId,
      quizId: event.quizId,
    });
  }
}
