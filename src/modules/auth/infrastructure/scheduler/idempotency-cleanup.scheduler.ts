import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { lt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { idempotencyKeys } from '@/core/database/schema/outbox/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import type { DrizzleDB } from '@/core/database/database.module';

const IDEMPOTENCY_CLEANUP_LOCK_KEY = 'auth:cron:idempotency_cleanup';
const IDEMPOTENCY_CLEANUP_LOCK_TTL_MS = 60 * 1000;
const IDEMPOTENCY_CLEANUP_JOB = 'common-idempotency-cleanup';

@Injectable()
export class IdempotencyCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(IdempotencyCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 5 * * *')
  async handleIdempotencyKeyCleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    await this.runCleanup();
  }

  async triggerCleanup(): Promise<number> {
    return this.runCleanup();
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: IDEMPOTENCY_CLEANUP_LOCK_KEY,
      lockTtlMs: IDEMPOTENCY_CLEANUP_LOCK_TTL_MS,
      job: IDEMPOTENCY_CLEANUP_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'idempotency_cleanup_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  private async runCleanup(): Promise<number> {
    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return 0;

    try {
      const now = new Date().toISOString();

      const deletedCount =
        (
          (await this.db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now))) as {
            rowCount?: number;
          }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'idempotency_cleanup_complete',
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'idempotency_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(IDEMPOTENCY_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
