import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { RetryQueue, type RetryableHandler } from '@/common/events/retry-queue';
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

@Injectable()
export class AttemptDomainEventBus
  implements AttemptDomainEventBusPort, OnModuleInit, OnModuleDestroy
{
  private readonly retryQueue: RetryQueue<unknown>;

  constructor(
    @Inject(CACHE_PROVIDER) cache: CacheProvider,
    @InjectPinoLogger(AttemptDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {
    this.retryQueue = new RetryQueue<unknown>(cache, logger, {
      retryQueuePrefix: 'attempt:event_retry_queue',
      deadLetterKey: 'attempt:event_dead_letter',
      retryDelaysMs: [5_000, 10_000, 20_000, 40_000, 80_000] as const,
      pollIntervalMs: 10_000,
      pollLockKey: 'attempt:event_retry_poll_lock',
      pollLockTtlMs: 8_000,
      loggerName: AttemptDomainEventBus.name,
    });
  }

  onModuleInit(): void {
    this.retryQueue.start();
  }

  onModuleDestroy(): void {
    this.retryQueue.stop();
  }

  subscribe(handler: AttemptEventHandler): () => void {
    const retryHandler: RetryableHandler<unknown> = (event) => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'attempt_event_handler_error',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
    return this.retryQueue.subscribe(retryHandler);
  }

  emit(event: unknown): void {
    this.retryQueue.dispatch(event);
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
