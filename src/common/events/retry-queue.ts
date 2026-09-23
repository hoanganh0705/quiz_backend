import { Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  correlationIdStorage,
  createCorrelationId,
  getCorrelationId,
} from '@/common/interceptors/correlation-id';

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
      .set(queued.tierKey, JSON.stringify(queued), delayMs + RetryQueue.QUEUE_TTL_PADDING_MS)
      .then(() => this.cache.rpushJson(`${this.config.retryQueuePrefix}:keys`, queued.tierKey));
  }

  private tierKey(attempt: number, nextRetryAt: number): string {
    return `${this.config.retryQueuePrefix}:tier-${attempt}${this.tierSeparator}${nextRetryAt}`;
  }

  private async moveToDeadLetter(event: T, attempt: number, error: unknown): Promise<void> {
    this.logger.error({
      event: 'retry_dead_lettered',
      loggerName: this.config.loggerName,
      attempts: attempt,
      error: error instanceof Error ? error.message : String(error),
    });

    await this.cache.rpushJson(this.config.deadLetterKey, {
      event,
      failedAt: new Date().toISOString(),
      lastAttempt: attempt,
      lastError: error instanceof Error ? error.message : String(error),
    });
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

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      const peekedKey = await this.cache.lpopJson<string>(`${this.config.retryQueuePrefix}:keys`);
      if (peekedKey === null) return;

      const raw = await this.cache.get(peekedKey);
      if (raw === null) continue;

      let queued: QueuedItem<T>;
      try {
        queued = JSON.parse(raw) as QueuedItem<T>;
      } catch {
        continue;
      }

      if (queued.nextRetryAt > now) {
        await this.cache.rpushJson(`${this.config.retryQueuePrefix}:keys`, queued.tierKey);
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
}
