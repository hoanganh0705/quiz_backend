/**
 * Discussion Domain Event Bus Implementation
 *
 * In-process event bus using the observer pattern with Redis-backed retry
 * and dead-letter queues for reliable event delivery.
 *
 * Retry strategy: exponential backoff (5s, 10s, 20s, 40s, 80s),
 * max 5 attempts before permanently dead-lettering.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DiscussionDomainEventBusPort } from './discussion-event-bus.port';
import type { DiscussionDomainEvent } from './discussion-domain.events';
import type {
  CommentCreatedEvent,
  CommentDeletedEvent,
  CommentHiddenEvent,
  DiscussionThreadCreatedEvent,
  DiscussionThreadSolvedEvent,
  ThreadClosedEvent,
  ThreadDeletedEvent,
  ThreadReopenedEvent,
  ThreadHiddenEvent,
  ContentReportedEvent,
  ReportReviewedEvent,
} from './discussion-domain.events';

interface QueuedEvent {
  event: DiscussionDomainEvent;
  attempt: number;
  nextRetryAt: number; // Unix timestamp (ms)
}

@Injectable()
export class DiscussionDomainEventBus implements DiscussionDomainEventBusPort, OnModuleInit, OnModuleDestroy {
  private static readonly RETRY_QUEUE_KEY = 'discussion:event_retry_queue';
  private static readonly DEAD_LETTER_KEY = 'discussion:event_dead_letter';
  private static readonly RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 80_000] as const;
  private static readonly MAX_RETRIES = DiscussionDomainEventBus.RETRY_DELAYS_MS.length;
  private static readonly POLL_INTERVAL_MS = 10_000;

  private handlers: Array<(event: DiscussionDomainEvent) => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @InjectPinoLogger(DiscussionDomainEventBus.name) private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.processRetryQueue();
    }, DiscussionDomainEventBus.POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(handler: (event: DiscussionDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: DiscussionDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.scheduleRetry(event, /* attempt= */ 1, error);
      }
    }
  }

  private scheduleRetry(event: DiscussionDomainEvent, attempt: number, error: unknown): void {
    if (attempt > DiscussionDomainEventBus.MAX_RETRIES) {
      void this.moveToDeadLetter(event, attempt, error);
      return;
    }

    const delayMs =
      DiscussionDomainEventBus.RETRY_DELAYS_MS[attempt - 1] ??
      DiscussionDomainEventBus.RETRY_DELAYS_MS[DiscussionDomainEventBus.RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = Date.now() + delayMs;

    const queued: QueuedEvent = { event, attempt, nextRetryAt };

    this.logger.warn({
      event: 'discussion_event_retry_scheduled',
      eventType: event.eventType,
      attempt,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
      delayMs,
      error: error instanceof Error ? error.message : String(error),
    });

    void this.cache.rpushJson(DiscussionDomainEventBus.RETRY_QUEUE_KEY, queued);
  }

  private async moveToDeadLetter(event: DiscussionDomainEvent, attempt: number, error: unknown): Promise<void> {
    this.logger.error({
      event: 'discussion_event_dead_lettered',
      eventType: event.eventType,
      attempts: attempt,
      error: error instanceof Error ? error.message : String(error),
    });

    await this.cache.rpushJson(DiscussionDomainEventBus.DEAD_LETTER_KEY, {
      event,
      failedAt: new Date().toISOString(),
      lastAttempt: attempt,
      lastError: error instanceof Error ? error.message : String(error),
    });
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();

    while (true) {
      const queued = await this.cache.lpopJson<QueuedEvent>(DiscussionDomainEventBus.RETRY_QUEUE_KEY);
      if (queued === null) break;

      if (queued.nextRetryAt > now) {
        await this.cache.rpushJson(DiscussionDomainEventBus.RETRY_QUEUE_KEY, queued);
        break;
      }

      const nextAttempt = queued.attempt + 1;

      for (const handler of this.handlers) {
        try {
          handler(queued.event);
        } catch (error) {
          this.scheduleRetry(queued.event, nextAttempt, error);
          break;
        }
      }
    }
  }

  emitCommentCreated(event: CommentCreatedEvent): void {
    this.emit(event);
  }

  emitCommentDeleted(event: CommentDeletedEvent): void {
    this.emit(event);
  }

  emitCommentHidden(event: CommentHiddenEvent): void {
    this.emit(event);
  }

  emitThreadCreated(event: DiscussionThreadCreatedEvent): void {
    this.emit(event);
  }

  emitThreadSolved(event: DiscussionThreadSolvedEvent): void {
    this.emit(event);
  }

  emitThreadClosed(event: ThreadClosedEvent): void {
    this.emit(event);
  }

  emitThreadDeleted(event: ThreadDeletedEvent): void {
    this.emit(event);
  }

  emitThreadReopened(event: ThreadReopenedEvent): void {
    this.emit(event);
  }

  emitThreadHidden(event: ThreadHiddenEvent): void {
    this.emit(event);
  }

  emitContentReported(event: ContentReportedEvent): void {
    this.emit(event);
  }

  emitReportReviewed(event: ReportReviewedEvent): void {
    this.emit(event);
  }
}
