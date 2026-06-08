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
} from '../dto/response/leaderboard-response.dto';

@Injectable()
export class GetLeaderboardDistributionQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetLeaderboardDistributionQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetLeaderboardDistributionQuery): Promise<LeaderboardDistributionResponseDto> {
    this.logger.debug({
      event: 'get_leaderboard_distribution',
      period: query.period,
    });

    const distribution = await this.rankingRepository.getLeaderboardDistribution(query.period);

    return {
      totalUsers: distribution.totalUsers,
      remainingUsers: distribution.remainingUsers,
      buckets: distribution.buckets.map((bucket) => this.toBucketDto(bucket)),
    };
  }

  private toBucketDto(bucket: {
    label: string;
    count: number;
  }): LeaderboardDistributionBucketDto {
    return {
      label: bucket.label,
      count: bucket.count,
    };
  }
}
