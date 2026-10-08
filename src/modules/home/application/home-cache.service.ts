import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import type { HomeBundleResponseDto } from '../dto/response/home-bundle-response.dto';

export const HOME_CACHE_KEY = 'home:v1';
export const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

const STAMPEDE_LOCK_TTL_MS = 5_000;
const STAMPEDE_RETRY_DELAY_MS = 50;
const STAMPEDE_MAX_RETRIES = 10;

@Injectable()
export class HomeCacheService {
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(HomeCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getOrSetBundle(
    fetcher: () => Promise<HomeBundleResponseDto>,
  ): Promise<HomeBundleResponseDto> {
    return this.cache.getOrSetWithStampedeProtection<HomeBundleResponseDto>(
      HOME_CACHE_KEY,
      HOME_CACHE_TTL_MS,
      fetcher,
      STAMPEDE_LOCK_TTL_MS,
      STAMPEDE_RETRY_DELAY_MS,
      STAMPEDE_MAX_RETRIES,
    );
  }

  async invalidate(): Promise<void> {
    await this.cache.del(HOME_CACHE_KEY);
    this.logger.debug({ event: 'home_cache_invalidated' });
  }
}
