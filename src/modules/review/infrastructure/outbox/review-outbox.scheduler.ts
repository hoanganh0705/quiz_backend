import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ReviewOutboxProcessorService } from './review-outbox-processor.service';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';

const REVIEW_OUTBOX_TICK_LOCK_KEY = 'review:cron:outbox_drain';
const REVIEW_OUTBOX_TICK_LOCK_TTL_MS = 30 * 1000;
const REVIEW_OUTBOX_TICK_JOB = 'review-outbox-drain';

@Injectable()
export class ReviewOutboxSchedulerService {
  constructor(
    private readonly reviewOutboxProcessor: ReviewOutboxProcessorService,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(ReviewOutboxSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleOutboxTick(): Promise<void> {
    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return;
    try {
      await this.runTick();
    } finally {
      await this.cache.releaseAdvisoryLock(REVIEW_OUTBOX_TICK_LOCK_KEY, lockToken);
    }
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: REVIEW_OUTBOX_TICK_LOCK_KEY,
      lockTtlMs: REVIEW_OUTBOX_TICK_LOCK_TTL_MS,
      job: REVIEW_OUTBOX_TICK_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'review_outbox_tick_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  private async runTick(): Promise<void> {
    try {
      const summary = await this.reviewOutboxProcessor.processPendingEvents();
      if (summary.processed > 0 || summary.failed > 0) {
        this.logger.info({
          event: 'review_outbox_tick',
          ...summary,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'review_outbox_tick_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
