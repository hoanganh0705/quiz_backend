import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { outboxEvents } from '@/core/database/schema/outbox/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import type { DrizzleDB } from '@/core/database/database.module';

const OUTBOX_RETENTION_DAYS = Number(process.env['OUTBOX_RETENTION_DAYS'] ?? 7);
const OUTBOX_CLEANUP_LOCK_KEY = 'outbox:cron:cleanup';
const OUTBOX_CLEANUP_LOCK_TTL_MS = 2 * 60 * 1000;
const OUTBOX_CLEANUP_JOB = 'auth-outbox-cleanup';

@Injectable()
export class OutboxCleanupScheduler implements OnModuleDestroy {
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
    @InjectPinoLogger(OutboxCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 3 * * *')
  async handleOutboxCleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    await this.runCleanup();
  }

  async triggerCleanup(): Promise<number> {
    return this.runCleanup();
  }

  private async runCleanup(): Promise<number> {
    const lock = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: OUTBOX_CLEANUP_LOCK_KEY,
      lockTtlMs: OUTBOX_CLEANUP_LOCK_TTL_MS,
      job: OUTBOX_CLEANUP_JOB,
    });
    if (!lock.acquired) {
      this.logger.debug({
        event: 'outbox_cleanup_skipped_lock_held',
        reason: lock.reason,
      });
      return 0;
    }

    try {
      const cutoff = new Date(Date.now() - OUTBOX_RETENTION_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const deletedCount =
        (
          (await this.db
            .delete(outboxEvents)
            .where(sql`processed_at IS NOT NULL AND processed_at < ${cutoff}::timestamptz`)) as {
            rowCount?: number;
          }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'outbox_cleanup_complete',
        deletedCount,
        retentionDays: OUTBOX_RETENTION_DAYS,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'outbox_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(OUTBOX_CLEANUP_LOCK_KEY, lock.token);
    }
  }
}
