import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { socialFeedActivities } from '@/core/database/schema/social/schema';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { DrizzleDB } from '@/core/database/database.module';

const SOCIAL_FEED_RETENTION_DAYS = Number(process.env['SOCIAL_FEED_RETENTION_DAYS'] ?? 30);
const SOCIAL_FEED_CLEANUP_LOCK_KEY = 'social:cron:feed_cleanup';
const SOCIAL_FEED_CLEANUP_LOCK_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class SocialFeedCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(SocialFeedCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  @Cron('0 1 * * *')
  async handleSocialFeedCleanup(): Promise<void> {
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
      SOCIAL_FEED_CLEANUP_LOCK_KEY,
      SOCIAL_FEED_CLEANUP_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({ event: 'social_feed_cleanup_skipped_lock_held' });
      return 0;
    }

    try {
      const cutoff = new Date(Date.now() - SOCIAL_FEED_RETENTION_DAYS * 86_400_000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const deletedCount =
        (
          (await this.db
            .delete(socialFeedActivities)
            .where(sql`created_at < ${cutoff}::timestamptz`)) as { rowCount?: number }
        ).rowCount ?? 0;

      this.logger.info({
        event: 'social_feed_cleanup_complete',
        deletedCount,
        retentionDays: SOCIAL_FEED_RETENTION_DAYS,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'social_feed_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    } finally {
      await this.cache.releaseAdvisoryLock(SOCIAL_FEED_CLEANUP_LOCK_KEY, lockToken);
    }
  }
}
