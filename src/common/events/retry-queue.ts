/**
 * Delayed-retry queue for in-process event handlers.
 *
 * Ordering model
 * --------------
 * Each retryable item is recorded as a pair:
 *   - a payload key (`<prefix>:tier-N::<nextRetryAt>`) holding the JSON
 *     of `{ event, attempt, nextRetryAt, correlationId, tierKey }` with
 *     a TTL slightly larger than the wait so an unclaimed item does
 *     not linger forever
 *   - an index entry (`<prefix>:index`) in a Redis sorted set, scored
 *     by `nextRetryAt`. The poll loop scans the index for entries with
 *     score `<= now`, claims each one (atomic `ZREM` + `GETDEL`), and
 *     hands the payload to the handler.
 *
 * Not-yet-due items stay in the index untouched. The poll stops at the
 * first item with a future score and resumes on the next tick, so the
 * ordering of items enqueued later is preserved.
 *
 * Dead letters
 * ------------
 * Items that exhaust `retryDelaysMs.length` are pushed to a JSON list
 * with `LTRIM` bounding the list to the last 1000 entries and a 7-day
 * TTL refreshed on every push — neither of which can grow unbounded.
 */

import {
  correlationIdStorage,
  createCorrelationId,
  getCorrelationId,
} from '@/common/interceptors/correlation-id';
import { PinoLogger } from 'nestjs-pino';
import { CacheProvider } from '../ports/cache.provider';

export interface RetryableHandler<T> {
  (event: T): void | Promise<void>;
}

export interface RetryQueueConfig {
  retryQueuePrefix: string;
  deadLetterKey: string;
  retryDelaysMs: readonly number[];
  pollIntervalMs: number;
  pollLockKey: string;
  pollLockTtlMs: number;
  loggerName: string;
  tierSeparator?: string;
}

interface QueuedItem<T> {
  event: T;
  attempt: number;
  nextRetryAt: number;
  correlationId?: string;
  tierKey: string;
}

export class RetryQueue<T> {
  private static readonly QUEUE_TTL_PADDING_MS = 5 * 60 * 1000;
  private static readonly DEAD_LETTER_LIMIT = 1000;
  private static readonly DEAD_LETTER_TTL_SECONDS = 7 * 24 * 60 * 60;
  private static readonly DRAIN_BATCH = 64;

  private readonly handlers: Array<RetryableHandler<T>> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxRetries: number;
  private readonly tierSeparator: string;

  constructor(
    private readonly cache: CacheProvider,
    private readonly logger: PinoLogger,
    private readonly config: RetryQueueConfig,
  ) {
    this.maxRetries = config.retryDelaysMs.length;
    this.tierSeparator = config.tierSeparator ?? '::';
  }

  start(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      void this.processRetryQueue();
    }, this.config.pollIntervalMs);
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(handler: RetryableHandler<T>): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  dispatch(event: T): void {
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
    event: T,
    attempt: number,
    error: unknown,
    correlationId: string | undefined,
  ): void {
    if (attempt > this.maxRetries) {
      void this.moveToDeadLetter(event, attempt, error);
      return;
    }

    const delayMs =
      this.config.retryDelaysMs[attempt - 1] ??
      this.config.retryDelaysMs[this.config.retryDelaysMs.length - 1];
    const nextRetryAt = Date.now() + delayMs;
    const tierKey = this.tierKey(attempt, nextRetryAt);
    const queued: QueuedItem<T> = {
      event,
      attempt,
      nextRetryAt,
      correlationId,
      tierKey,
    };

    this.logger.warn({
      event: 'retry_scheduled',
      loggerName: this.config.loggerName,
      attempt,
      nextRetryAt: new Date(nextRetryAt).toISOString(),
      delayMs,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    void this.cache
      .multiExec([
        [
          'set',
          queued.tierKey,
          JSON.stringify(queued),
          'PX',
          delayMs + RetryQueue.QUEUE_TTL_PADDING_MS,
        ],
        ['zadd', `${this.config.retryQueuePrefix}:index`, nextRetryAt.toString(), queued.tierKey],
      ])
      .catch((error: unknown) => {
        this.logger.warn({
          event: 'retry_index_write_failed',
          loggerName: this.config.loggerName,
          tierKey: queued.tierKey,
          message: error instanceof Error ? error.message : 'unknown',
        });
      });
  }

  private tierKey(attempt: number, nextRetryAt: number): string {
    return `${this.config.retryQueuePrefix}:tier-${attempt}${this.tierSeparator}${nextRetryAt}`;
  }

  private indexKey(): string {
    return `${this.config.retryQueuePrefix}:index`;
  }

  private async moveToDeadLetter(event: T, attempt: number, error: unknown): Promise<void> {
    this.logger.error({
      event: 'retry_dead_lettered',
      loggerName: this.config.loggerName,
      attempts: attempt,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await this.cache.pipelineDeadLetterPush(
        this.config.deadLetterKey,
        {
          event,
          failedAt: new Date().toISOString(),
          lastAttempt: attempt,
          lastError: error instanceof Error ? error.message : String(error),
        },
        RetryQueue.DEAD_LETTER_LIMIT,
        RetryQueue.DEAD_LETTER_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn({
        event: 'retry_dead_letter_write_failed',
        loggerName: this.config.loggerName,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  private async processRetryQueue(): Promise<void> {
    const lockToken = await this.cache.acquireAdvisoryLock(
      this.config.pollLockKey,
      this.config.pollLockTtlMs,
    );
    if (lockToken === null) return;

    try {
      await this.drainOnce();
    } catch (error) {
      this.logger.error({
        event: 'retry_drain_failed',
        loggerName: this.config.loggerName,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(this.config.pollLockKey, lockToken);
    }
  }

  private async drainOnce(): Promise<void> {
    const now = Date.now();

    const due = await this.cache.zrangeByScore(
      this.indexKey(),
      '-inf',
      now,
      RetryQueue.DRAIN_BATCH,
      true,
    );
    if (due.length === 0) return;

    for (const { member: tierKey, score } of due) {
      if (score > now) continue;

      const removed = await this.cache.zrem(this.indexKey(), tierKey);
      if (!removed) continue;

      const raw = await this.cache.getDel(tierKey);
      if (raw === null) continue;

      let queued: QueuedItem<T>;
      try {
        queued = JSON.parse(raw) as QueuedItem<T>;
      } catch {
        continue;
      }

      if (queued.nextRetryAt > now) {
        await this.cache.zaddByScore(this.indexKey(), queued.nextRetryAt, tierKey);
        return;
      }

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
}
