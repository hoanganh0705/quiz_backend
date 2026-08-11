import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  QuizCreatedEvent,
  QuizUpdatedEvent,
  QuizDeletedEvent,
  QuizVersionCreatedEvent,
  QuizVersionPublishedEvent,
} from './quiz-domain.events';
import {
  type QuizDomainEventBusPort,
  type QuizEventHandler,
  QUIZ_DOMAIN_EVENT_BUS,
} from '../ports/quiz-domain-event-bus.port';

/**
 * Simple domain event bus for Quiz aggregate events.
 *
 * This is a lightweight in-process event bus using the observer pattern.
 * Events are dispatched synchronously within the same request lifecycle.
 *
 * Use `emit()` to dispatch events and `subscribe()` to register handlers.
 */
@Injectable()
export class QuizDomainEventBus implements QuizDomainEventBusPort {
  private handlers: QuizEventHandler[] = [];

  constructor(
    @InjectPinoLogger(QuizDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: QuizEventHandler): () => void {
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
          event: 'quiz_domain_event_handler_failed',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
  }

  emitQuizCreated(event: QuizCreatedEvent): void {
    this.emit(event);
  }

  emitQuizUpdated(event: QuizUpdatedEvent): void {
    this.emit(event);
  }

  emitQuizDeleted(event: QuizDeletedEvent): void {
    this.emit(event);
  }

  emitQuizVersionCreated(event: QuizVersionCreatedEvent): void {
    this.emit(event);
  }

  emitQuizVersionPublished(event: QuizVersionPublishedEvent): void {
    this.emit(event);
  }
}

export { QUIZ_DOMAIN_EVENT_BUS };
