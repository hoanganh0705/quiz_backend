/**
 * Comment Domain Event Bus Implementation
 *
 * In-process observer bus with a Redis-backed delayed-retry queue.
 * The retry queue partitions per attempt tier (`tier-1` … `tier-N`)
 * so each tier is FIFO-ordered by `nextRetryAt`. A poll timer claims
 * the next batch from the lowest tier whose wait window has elapsed;
 * multi-instance deployments coordinate through a short advisory lock
 * so only one replica drains a tier per tick.
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
  nextRetryAt: number;
  correlationId?: string;
  tierKey: string;
}

const QUEUE_ID_SEP = '::';
const QUEUE_TTL_PADDING_MS = 5 * 60 * 1000;

@Injectable()
export class CommentDomainEventBus
  implements CommentDomainEventBusPort, OnModuleInit, OnModuleDestroy
{
  private static readonly RETRY_QUEUE_PREFIX = 'comment:event_retry_queue';
  private static readonly DEAD_LETTER_KEY = 'comment:event_dead_letter';
  private static readonly RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 80_000] as const;
  private static readonly MAX_RETRIES = CommentDomainEventBus.RETRY_DELAYS_MS.length;
  private static readonly POLL_INTERVAL_MS = 10_000;
  private static readonly POLL_LOCK_KEY = 'comment:event_retry_poll_lock';
  private static readonly POLL_LOCK_TTL_MS = 8_000;

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
        const correlationId = getCorrelationId();
        this.scheduleRetry(event, 1, error, correlationId);
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
    const tierKey = this.tierKey(attempt, nextRetryAt);
    const queued: QueuedEvent = {
      event,
      attempt,
      nextRetryAt,
      correlationId,
      tierKey,
    };

    this.logger.warn({
      event: 'comment_event_retry_scheduled',
      eventType: event.eventType,
      attempt,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
      delayMs,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    void this.cache
      .set(queued.tierKey, JSON.stringify(queued), delayMs + QUEUE_TTL_PADDING_MS)
      .then(() => this.cache.rpushJson(CommentDomainEventBus.RETRY_QUEUE_PREFIX, queued.tierKey));
  }

  private tierKey(attempt: number, nextRetryAt: number): string {
    return `${CommentDomainEventBus.RETRY_QUEUE_PREFIX}:tier-${attempt}${QUEUE_ID_SEP}${nextRetryAt}`;
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
    const lockToken = await this.cache.acquireAdvisoryLock(
      CommentDomainEventBus.POLL_LOCK_KEY,
      CommentDomainEventBus.POLL_LOCK_TTL_MS,
    );
    if (lockToken === null) return;

    try {
      await this.drainOnce();
    } catch (error) {
      this.logger.error({
        event: 'comment_event_retry_drain_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(CommentDomainEventBus.POLL_LOCK_KEY, lockToken);
    }
  }

  private async drainOnce(): Promise<void> {
    const now = Date.now();

    for (let attempt = 1; attempt <= CommentDomainEventBus.MAX_RETRIES; attempt += 1) {
      const peekedKey = await this.cache.lpopJson<string>(CommentDomainEventBus.RETRY_QUEUE_PREFIX);
      if (peekedKey === null) return;

      const raw = await this.cache.get(peekedKey);
      if (raw === null) continue;

      let queued: QueuedEvent;
      try {
        queued = JSON.parse(raw) as QueuedEvent;
      } catch {
        continue;
      }

      if (queued.nextRetryAt > now) {
        await this.cache.rpushJson(CommentDomainEventBus.RETRY_QUEUE_PREFIX, queued.tierKey);
        return;
      }

      const drained = await this.cache.getDel(peekedKey);
      if (drained === null) continue;

      const correlationId = queued.correlationId ?? createCorrelationId();
      correlationIdStorage.run({ correlationId }, () => {
        for (const handler of this.handlers) {
          try {
            handler(queued.event);
          } catch (error) {
            this.scheduleRetry(queued.event, queued.attempt + 1, error, correlationId);
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
