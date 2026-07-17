import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetMyRankingHistoryQuery } from '../domain/types/get-my-ranking-history.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import { RankingPeriod } from '../domain/types/ranking.types';
import { LeaderboardPeriodEnum, RankingPeriodEnum } from '../dto/request/leaderboard-query.dto';
import type {
  RankingHistoryItemDto,
  RankingHistoryResponseDto,
} from '../dto/response/leaderboard-history.dto';

@Injectable()
export class GetMyRankingHistoryQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetMyRankingHistoryQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetMyRankingHistoryQuery): Promise<RankingHistoryResponseDto> {
    this.validateDateRange(query.from, query.to);

    this.logger.debug({
      event: 'get_my_ranking_history',
      userId: query.userId,
      period: query.period,
      from: query.from?.toISOString(),
      to: query.to?.toISOString(),
    });

    const items = await this.rankingRepository.getUserRankingHistory({
      userId: query.userId,
      period: query.period,
      from: query.from,
      to: query.to,
    });

    return {
      items: items.map((item) => this.toDto(item.snapshotDate, item.rank)),
    };
  }

  private toDto(snapshotDate: string, rank: number): RankingHistoryItemDto {
    return {
      date: snapshotDate.slice(0, 10),
      rank,
    };
  }

  private validateDateRange(from?: Date, to?: Date): void {
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid to date');
    }

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('The from date must be before or equal to the to date');
    }
  }
}

export const mapRankingPeriodEnumToDomain = (
  period: RankingPeriodEnum | LeaderboardPeriodEnum,
): RankingPeriod => {
  switch (period) {
    case RankingPeriodEnum.DAILY:
      return RankingPeriod.DAILY;
    case RankingPeriodEnum.WEEKLY:
      return RankingPeriod.WEEKLY;
    case RankingPeriodEnum.MONTHLY:
      return RankingPeriod.MONTHLY;
    case RankingPeriodEnum.ALL_TIME:
    default:
      return RankingPeriod.ALL_TIME;
  }
};
