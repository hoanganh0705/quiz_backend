import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

export const SOCIAL_FEED_CACHE_TTL_MS = 60_000;

const STAMPEDE_LOCK_TTL_MS = 5_000;
const STAMPEDE_RETRY_DELAY_MS = 50;
const STAMPEDE_MAX_RETRIES = 10;

@Injectable()
export class SocialFeedCache implements OnModuleDestroy {
  private static readonly CACHE_KEY_PREFIX = 'feed';

  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(SocialFeedCache.name)
    private readonly logger: PinoLogger,
  ) {}

  async getOrSetFeed<T>(
    userId: string,
    versionHash: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    return this.cache.getOrSetWithStampedeProtection<T>(
      this.feedKey(userId, versionHash),
      SOCIAL_FEED_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidateFeed(userId: string): Promise<void> {
    await this.cache.unlinkByPattern(`${SocialFeedCache.CACHE_KEY_PREFIX}:${userId}:v*`);
    this.logger.debug({ event: 'social_feed_cache_invalidated', userId });
  }

  private feedKey(userId: string, versionHash: string): string {
    return `${SocialFeedCache.CACHE_KEY_PREFIX}:${userId}:v${versionHash}`;
  }

  onModuleDestroy(): void {
    // No cleanup needed for read-through cache.
  }
}
