import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { deadLetterEvents } from '@/core/database/schema/dead-letter/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import { RetryQueueMetrics } from '@/core/redis/retry-queue.metrics';
import type { DrizzleDB } from '@/core/database/database.module';

const DLQ_DRAIN_LOCK_KEY = 'common:cron:retry_queue_dlq_drain';
const DLQ_DRAIN_LOCK_TTL_MS = 5 * 60 * 1000;
const DLQ_DRAIN_JOB = 'common-retry-queue-dlq-drain';
const DLQ_DRAIN_BATCH = 100;

interface DeadLetterEnvelope {
  event: unknown;
  failedAt: string;
  lastAttempt: number;
  lastError: string;
  correlationId?: string;
}

/**
 * Periodic drain of every retry-queue dead-letter list.
 *
 * For each registered tier (`attempt`, `coin`, `comment`, ...)
 * the cron tick:
 *
 *   1. Acquires the scheduler lock so a second replica does not
 *      drain the same envelopes twice.
 *   2. Reads `LLEN tier:<tier>:dlq` and updates the
 *      `quiz_retry_queue_dlq_size{tier}` gauge so operators see
 *      the backlog on the standard Prometheus endpoint.
 *   3. Pops up to `DLQ_DRAIN_BATCH` envelopes off the list and
 *      writes each one to the `dead_letter_events` PostgreSQL
 *      table for forensic inspection.
 *
 * The drain is intentionally a copy, not a re-enqueue. Items that
 * exhausted their retry budget will fail again the moment the
 * handler retries them; the durable record is what enables the
 * on-call engineer to investigate the cause rather than fight
 * an infinite loop.
 */
@Injectable()
export class RetryQueueDrainScheduler {
  private readonly tiers: ReadonlyArray<{ tier: string; deadLetterKey: string }>;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    private readonly retryQueueMetrics: RetryQueueMetrics,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(RetryQueueDrainScheduler.name)
    private readonly logger: PinoLogger,
  ) {
    this.tiers = [
      {
        tier: 'attempt',
        deadLetterKey: process.env.RETRY_QUEUE_DLQ_ATTEMPT_KEY ?? 'tier:attempt:dlq',
      },
      { tier: 'coin', deadLetterKey: process.env.RETRY_QUEUE_DLQ_COIN_KEY ?? 'tier:coin:dlq' },
      {
        tier: 'comment',
        deadLetterKey: process.env.RETRY_QUEUE_DLQ_COMMENT_KEY ?? 'tier:comment:dlq',
      },
    ];
  }

  @Cron('*/5 * * * *')
  async handleDrain(): Promise<void> {
    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return;
    try {
      await this.runDrain();
    } finally {
      await this.cache.releaseAdvisoryLock(DLQ_DRAIN_LOCK_KEY, lockToken);
    }
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: DLQ_DRAIN_LOCK_KEY,
      lockTtlMs: DLQ_DRAIN_LOCK_TTL_MS,
      job: DLQ_DRAIN_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'retry_queue_dlq_drain_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  /**
   * Public entry point used by the operator CLI (`pnpm
   * retry-queue:drain`). Performs the same work as the cron tick
   * but synchronously returns the per-tier counts so the CLI can
   * print them.
   */
  async drainOnce(): Promise<Record<string, number>> {
    const summary: Record<string, number> = {};
    for (const { tier, deadLetterKey } of this.tiers) {
      const drained = await this.drainTier(tier, deadLetterKey);
      summary[tier] = drained;
    }
    return summary;
  }

  private async runDrain(): Promise<void> {
    for (const { tier, deadLetterKey } of this.tiers) {
      const size = await this.retryQueueMetrics.getDlqSize(tier, deadLetterKey);
      if (size >= 0) {
        this.metrics?.setRetryQueueDlqSize(tier, size);
      }
      await this.drainTier(tier, deadLetterKey);
    }
  }

  private async drainTier(tier: string, deadLetterKey: string): Promise<number> {
    let drained = 0;
    while (drained < DLQ_DRAIN_BATCH) {
      const raw = await this.cache.lpopJson<DeadLetterEnvelope>(deadLetterKey);
      if (raw === null) break;
      drained += 1;
      try {
        await this.persistEnvelope(tier, deadLetterKey, raw);
      } catch (error) {
        this.logger.error({
          event: 'retry_queue_dlq_drain_persist_failed',
          tier,
          deadLetterKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (drained > 0) {
      this.logger.info({
        event: 'retry_queue_dlq_drain_complete',
        tier,
        deadLetterKey,
        drained,
      });
    }
    return drained;
  }

  private async persistEnvelope(
    tier: string,
    sourceQueue: string,
    envelope: DeadLetterEnvelope,
  ): Promise<void> {
    await this.db.insert(deadLetterEvents).values({
      tier,
      sourceQueue,
      event: envelope.event,
      lastAttempt: envelope.lastAttempt,
      lastError: envelope.lastError ?? null,
      correlationId: envelope.correlationId ?? null,
    });
  }

  /**
   * Returns the current DLQ depth for every tier; used by the
   * metrics endpoint to seed the gauge before the cron tick
   * refreshes it.
   */
  async readTierSizes(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const { tier, deadLetterKey } of this.tiers) {
      result[tier] = await this.retryQueueMetrics.getDlqSize(tier, deadLetterKey);
    }
    return result;
  }
}
