import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetLeaderboardDistributionQuery } from '../domain/types/get-leaderboard-distribution.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type {
  LeaderboardDistributionBucketDto,
  LeaderboardDistributionResponseDto,
} from '../dto/response/leaderboard-stats.dto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const LEADERBOARD_DISTRIBUTION_CACHE_TTL_MS = 60_000;

@Injectable()
export class GetLeaderboardDistributionQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(GetLeaderboardDistributionQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    query: GetLeaderboardDistributionQuery,
  ): Promise<LeaderboardDistributionResponseDto> {
    this.logger.debug({
      event: 'get_leaderboard_distribution',
      period: query.period,
    });

    const cacheKey = `leaderboard:distribution:${query.period}`;
    return this.cache.getOrSetWithStampedeProtection<LeaderboardDistributionResponseDto>(
      cacheKey,
      LEADERBOARD_DISTRIBUTION_CACHE_TTL_MS,
      async () => {
        const distribution = await this.rankingRepository.getLeaderboardDistribution(query.period);
        return {
          totalUsers: distribution.totalUsers,
          remainingUsers: distribution.remainingUsers,
          buckets: distribution.buckets.map((bucket) => this.toBucketDto(bucket)),
        };
      },
      5_000,
      50,
      10,
    );
  }

  private toBucketDto(bucket: { label: string; count: number }): LeaderboardDistributionBucketDto {
    return {
      label: bucket.label,
      count: bucket.count,
    };
  }
}
