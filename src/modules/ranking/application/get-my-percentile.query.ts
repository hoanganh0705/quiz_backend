import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetMyPercentileQuery } from '../domain/types/get-my-percentile.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type { UserPercentileResponseDto } from '../dto/response/leaderboard-stats.dto';

@Injectable()
export class GetMyPercentileQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetMyPercentileQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetMyPercentileQuery): Promise<UserPercentileResponseDto> {
    this.logger.debug({
      event: 'get_my_percentile',
      userId: query.userId,
      period: query.period,
    });

    const [rank, totalUsers] = await Promise.all([
      this.rankingRepository.getUserRank(query.userId, query.period),
      this.rankingRepository.getLeaderboardSize(query.period),
    ]);

    if (rank === null || totalUsers === 0) {
      return {
        rank: null,
        totalUsers,
        percentile: null,
        betterThanUsers: null,
        worseThanUsers: null,
      };
    }

    const worseThanUsers = rank - 1;
    const betterThanUsers = totalUsers - rank;
    const percentile = Number((((totalUsers - rank) / totalUsers) * 100).toFixed(2));

    return {
      rank,
      totalUsers,
      percentile,
      betterThanUsers,
      worseThanUsers,
    };
  }
}
