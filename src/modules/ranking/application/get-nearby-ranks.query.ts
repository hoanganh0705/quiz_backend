import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetNearbyRanksQuery } from '../domain/types/get-nearby-ranks.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type {
  NearbyRankEntryDto,
  NearbyRanksResponseDto,
} from '../dto/response/leaderboard-nearby.dto';

@Injectable()
export class GetNearbyRanksQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetNearbyRanksQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetNearbyRanksQuery): Promise<NearbyRanksResponseDto> {
    this.logger.debug({
      event: 'get_nearby_ranks',
      userId: query.userId,
      period: query.period,
      radius: query.radius,
    });

    const result = await this.rankingRepository.getNearbyRanks({
      userId: query.userId,
      period: query.period,
      radius: query.radius,
    });

    return {
      above: result.above.map((entry) => this.toDto(entry)),
      me: result.me ? this.toDto(result.me) : null,
      below: result.below.map((entry) => this.toDto(entry)),
    };
  }

  private toDto(entry: {
    rank: number;
    userId: string;
    username: string;
    xp: number;
  }): NearbyRankEntryDto {
    return {
      rank: entry.rank,
      userId: entry.userId,
      username: entry.username,
      xp: entry.xp,
    };
  }
}
