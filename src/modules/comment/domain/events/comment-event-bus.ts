/**
 * Comment Domain Event Bus Implementation
 *
 * In-process event bus using the observer pattern with Redis-backed retry
 * and dead-letter queues for reliable event delivery within the lifetime
 * of a single process.
 *
 * Retry strategy: exponential backoff (5s, 10s, 20s, 40s, 80s),
 * max 5 attempts before permanently dead-lettering.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  correlationIdStorage,
  createCorrelationId,
  getCorrelationId,
} from '@/common/interceptors/correlation-id';
import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentDomainEvent,
  CommentEditedEvent,
  CommentHiddenEvent,
  CommentMentionedEvent,
  CommentReportedEvent,
  CommentRestoredEvent,
  ReportReviewedEvent,
  VoteCastEvent,
  VoteRemovedEvent,
} from './comment.events';
import type { CommentDomainEventBusPort } from './comment-event-bus.port';

interface QueuedEvent {
  event: CommentDomainEvent;
  attempt: number;
  nextRetryAt: number; // Unix timestamp (ms)
  // Captured at the time the retry was scheduled so the retry handler
  // (which runs much later on the polling timer) can restore the same
  // correlation ID into AsyncLocalStorage. Without this, all retried
  // events would log under whatever correlation ID the polling tick
  // happened to have, which is meaningless.
  correlationId?: string;
}

@Injectable()
export class CommentDomainEventBus
  implements CommentDomainEventBusPort, OnModuleInit, OnModuleDestroy
{
  private static readonly RETRY_QUEUE_KEY = 'comment:event_retry_queue';
  private static readonly DEAD_LETTER_KEY = 'comment:event_dead_letter';
  private static readonly RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 80_000] as const;
  private static readonly MAX_RETRIES = CommentDomainEventBus.RETRY_DELAYS_MS.length;
  private static readonly POLL_INTERVAL_MS = 10_000;

  private handlers: Array<(event: CommentDomainEvent) => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @InjectPinoLogger(CommentDomainEventBus.name) private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.processRetryQueue();
    }, CommentDomainEventBus.POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(handler: (event: CommentDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: CommentDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        // Capture the originating correlation ID (if any) so a future
        // retry, which runs from a polling timer with no inherent context,
        // can still join its log lines back to the original emit.
        const correlationId = getCorrelationId();
        this.scheduleRetry(event, /* attempt= */ 1, error, correlationId);
      }
    }
  }

  private scheduleRetry(
    event: CommentDomainEvent,
    attempt: number,
    error: unknown,
    correlationId: string | undefined,
  ): void {
    if (attempt > CommentDomainEventBus.MAX_RETRIES) {
      void this.moveToDeadLetter(event, attempt, error);
      return;
    }

    const delayMs =
      CommentDomainEventBus.RETRY_DELAYS_MS[attempt - 1] ??
      CommentDomainEventBus.RETRY_DELAYS_MS[CommentDomainEventBus.RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = Date.now() + delayMs;

    const queued: QueuedEvent = { event, attempt, nextRetryAt, correlationId };

    this.logger.warn({
      event: 'comment_event_retry_scheduled',
      eventType: event.eventType,
      attempt,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
      delayMs,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    void this.cache.rpushJson(CommentDomainEventBus.RETRY_QUEUE_KEY, queued);
  }

  private async moveToDeadLetter(
    event: CommentDomainEvent,
    attempt: number,
    error: unknown,
  ): Promise<void> {
    this.logger.error({
      event: 'comment_event_dead_lettered',
      eventType: event.eventType,
      attempts: attempt,
      error: error instanceof Error ? error.message : String(error),
    });

    await this.cache.rpushJson(CommentDomainEventBus.DEAD_LETTER_KEY, {
      event,
      failedAt: new Date().toISOString(),
      lastAttempt: attempt,
      lastError: error instanceof Error ? error.message : String(error),
    });
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();

    while (true) {
      const queued = await this.cache.lpopJson<QueuedEvent>(CommentDomainEventBus.RETRY_QUEUE_KEY);
      if (queued === null) break;

      if (queued.nextRetryAt > now) {
        await this.cache.rpushJson(CommentDomainEventBus.RETRY_QUEUE_KEY, queued);
        break;
      }

      const nextAttempt = queued.attempt + 1;
      // Re-establish a correlation context for this retry tick so the
      // log lines and downstream effects can be traced back to the
      // original emit. Falls back to a fresh UUID for queued events
      // that were persisted before correlation IDs were introduced.
      const correlationId = queued.correlationId ?? createCorrelationId();

      correlationIdStorage.run({ correlationId }, () => {
        for (const handler of this.handlers) {
          try {
            handler(queued.event);
          } catch (error) {
            this.scheduleRetry(queued.event, nextAttempt, error, correlationId);
            break;
          }
        }
      });
    }
  }

  emitCommentCreated(event: CommentCreatedEvent): void {
    this.emit(event);
  }

  emitCommentEdited(event: CommentEditedEvent): void {
    this.emit(event);
  }

  emitCommentDeleted(event: CommentDeletedEvent): void {
    this.emit(event);
  }

  emitCommentHidden(event: CommentHiddenEvent): void {
    this.emit(event);
  }

  emitCommentRestored(event: CommentRestoredEvent): void {
    this.emit(event);
  }

  emitCommentMentioned(event: CommentMentionedEvent): void {
    this.emit(event);
  }

  emitVoteCast(event: VoteCastEvent): void {
    this.emit(event);
  }

  emitVoteRemoved(event: VoteRemovedEvent): void {
    this.emit(event);
  }

  emitCommentReported(event: CommentReportedEvent): void {
    this.emit(event);
  }

  emitReportReviewed(event: ReportReviewedEvent): void {
    this.emit(event);
  }
}
