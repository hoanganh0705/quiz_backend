import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
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

export type QuizDomainEvent =
  | QuizCreatedEvent
  | QuizUpdatedEvent
  | QuizDeletedEvent
  | QuizVersionCreatedEvent
  | QuizVersionPublishedEvent;

@Injectable()
export class QuizDomainEventBus
  extends BaseDomainEventBus<unknown>
  implements QuizDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(QuizDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'quiz_domain_event' });
  }

  subscribe(handler: QuizEventHandler): () => void {
    return super.subscribe(handler as never);
  }

  emit(event: unknown): void {
    this.dispatch(event);
  }

  emitQuizCreated(event: QuizCreatedEvent): void {
    this.dispatch(event);
  }

  emitQuizUpdated(event: QuizUpdatedEvent): void {
    this.dispatch(event);
  }

  emitQuizDeleted(event: QuizDeletedEvent): void {
    this.dispatch(event);
  }

  emitQuizVersionCreated(event: QuizVersionCreatedEvent): void {
    this.dispatch(event);
  }

  emitQuizVersionPublished(event: QuizVersionPublishedEvent): void {
    this.dispatch(event);
  }
}

export { QUIZ_DOMAIN_EVENT_BUS };
