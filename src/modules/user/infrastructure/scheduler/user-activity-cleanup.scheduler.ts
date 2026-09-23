import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { userActivityEvents } from '@/core/database/schema/user/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DrizzleDB } from '@/core/database/database.module';

const USER_ACTIVITY_RETENTION_DAYS = Number(process.env['USER_ACTIVITY_RETENTION_DAYS'] ?? 180);
const USER_ACTIVITY_CLEANUP_LOCK_KEY = 'user:cron:activity_cleanup';
const USER_ACTIVITY_CLEANUP_LOCK_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class UserActivityCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(UserActivityCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 0 * * *')
  async handleUserActivityCleanup(): Promise<void> {
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
      USER_ACTIVITY_CLEANUP_LOCK_KEY,
      USER_ACTIVITY_CLEANUP_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({ event: 'user_activity_cleanup_skipped_lock_held' });
      return 0;
    }

    try {
      const cutoff = new Date(Date.now() - USER_ACTIVITY_RETENTION_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const deletedCount =
        (
          (await this.db
            .delete(userActivityEvents)
            .where(sql`created_at < ${cutoff}::timestamptz`)) as { rowCount?: number }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'user_activity_cleanup_complete',
        deletedCount,
        retentionDays: USER_ACTIVITY_RETENTION_DAYS,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'user_activity_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(USER_ACTIVITY_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
