import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { quizAttemptEvents } from '@/core/database/schema/quiz/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DrizzleDB } from '@/core/database/database.module';

const ATTEMPT_EVENTS_RETENTION_DAYS = Number(process.env['ATTEMPT_EVENTS_RETENTION_DAYS'] ?? 90);
const ATTEMPT_EVENTS_CLEANUP_LOCK_KEY = 'attempt:cron:events_cleanup';
const ATTEMPT_EVENTS_CLEANUP_LOCK_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AttemptEventsCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(AttemptEventsCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 2 * * 0')
  async handleAttemptEventsCleanup(): Promise<void> {
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
      ATTEMPT_EVENTS_CLEANUP_LOCK_KEY,
      ATTEMPT_EVENTS_CLEANUP_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({ event: 'attempt_events_cleanup_skipped_lock_held' });
      return 0;
    }

    try {
      const cutoff = new Date(Date.now() - ATTEMPT_EVENTS_RETENTION_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const deletedCount =
        (
          (await this.db
            .delete(quizAttemptEvents)
            .where(sql`created_at < ${cutoff}::timestamptz`)) as { rowCount?: number }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'attempt_events_cleanup_complete',
        deletedCount,
        retentionDays: ATTEMPT_EVENTS_RETENTION_DAYS,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'attempt_events_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(ATTEMPT_EVENTS_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
