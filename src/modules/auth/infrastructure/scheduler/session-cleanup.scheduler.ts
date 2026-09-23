import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql, or, lt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { userSessions } from '@/core/database/schema/auth/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DrizzleDB } from '@/core/database/database.module';

const SESSION_CLEANUP_LOCK_KEY = 'auth:cron:session_cleanup';
const SESSION_CLEANUP_LOCK_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class SessionCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(SessionCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 6 * * *')
  async handleSessionCleanup(): Promise<void> {
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
      SESSION_CLEANUP_LOCK_KEY,
      SESSION_CLEANUP_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({ event: 'session_cleanup_skipped_lock_held' });
      return 0;
    }

    try {
      const now = new Date().toISOString();

      const deletedCount =
        (
          (await this.db
            .delete(userSessions)
            .where(
              or(
                lt(userSessions.expiresAt, now),
                sql`${userSessions.revokedAt} IS NOT NULL AND ${userSessions.revokedAt} < ${now}::timestamptz`,
              ),
            )) as { rowCount?: number }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'session_cleanup_complete',
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'session_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(SESSION_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
