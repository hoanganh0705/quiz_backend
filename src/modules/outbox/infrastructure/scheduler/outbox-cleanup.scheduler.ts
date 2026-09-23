import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { outboxEvents } from '@/core/database/schema/outbox/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DrizzleDB } from '@/core/database/database.module';

const OUTBOX_RETENTION_DAYS = Number(process.env['OUTBOX_RETENTION_DAYS'] ?? 7);
const OUTBOX_CLEANUP_LOCK_KEY = 'outbox:cron:cleanup';
const OUTBOX_CLEANUP_LOCK_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class OutboxCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
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
    const lockToken = await this.cache.acquireAdvisoryLock(
      OUTBOX_CLEANUP_LOCK_KEY,
      OUTBOX_CLEANUP_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({ event: 'outbox_cleanup_skipped_lock_held' });
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
      await this.cache.releaseAdvisoryLock(OUTBOX_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
