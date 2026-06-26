import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetMyPeakRanksQuery } from '../domain/types/get-my-peak-ranks.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type { PeakRankDto, PeakRanksResponseDto } from '../dto/response/leaderboard-history.dto';

@Injectable()
export class GetMyPeakRanksQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetMyPeakRanksQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetMyPeakRanksQuery): Promise<PeakRanksResponseDto> {
    this.logger.debug({
      event: 'get_my_peak_ranks',
      userId: query.userId,
    });

    const peakRanks = await this.rankingRepository.getPeakRanks(query.userId);

    return {
      daily: this.toDto(peakRanks.daily.rank, peakRanks.daily.achievedAt),
      weekly: this.toDto(peakRanks.weekly.rank, peakRanks.weekly.achievedAt),
      monthly: this.toDto(peakRanks.monthly.rank, peakRanks.monthly.achievedAt),
      allTime: this.toDto(peakRanks.allTime.rank, peakRanks.allTime.achievedAt),
    };
  }

  private toDto(rank: number | null, achievedAt: string | null): PeakRankDto | null {
    if (rank === null) {
      return null;
    }

    return {
      rank,
      achievedAt,
    };
  }
}
