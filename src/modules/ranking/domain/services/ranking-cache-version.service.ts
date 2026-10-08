import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { RankingPeriod } from '../types/ranking.types';

const RANKING_VERSION_KEY_PREFIX = 'ranking:version';
const RANKING_VERSION_TTL_MS = 86_400_000;
const RANKING_VERSION_TTL_SECONDS = Math.floor(RANKING_VERSION_TTL_MS / 1000);

@Injectable()
export class RankingCacheVersionService {
  constructor(
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(RankingCacheVersionService.name)
    private readonly logger: PinoLogger,
  ) {}

  versionKeyFor(period: RankingPeriod): string {
    return `${RANKING_VERSION_KEY_PREFIX}:${period}`;
  }

  async getVersion(period: RankingPeriod): Promise<number> {
    try {
      const raw = await this.cache.get(this.versionKeyFor(period));
      return Number(raw ?? '0') || 0;
    } catch (error) {
      this.logger.warn({
        event: 'ranking_version_read_failed',
        period,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async bumpVersion(period: RankingPeriod): Promise<void> {
    const key = this.versionKeyFor(period);
    try {
      const next = await this.cache.incrementCounterWithInitialTtlSeconds(
        key,
        RANKING_VERSION_TTL_SECONDS,
      );
      this.logger.debug({
        event: 'ranking_version_bumped',
        period,
        version: next,
      });
    } catch (error) {
      this.logger.warn({
        event: 'ranking_version_bump_failed',
        period,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async bumpAllPeriods(): Promise<void> {
    await Promise.all([
      this.bumpVersion(RankingPeriod.DAILY),
      this.bumpVersion(RankingPeriod.WEEKLY),
      this.bumpVersion(RankingPeriod.MONTHLY),
      this.bumpVersion(RankingPeriod.ALL_TIME),
    ]);
  }
}
