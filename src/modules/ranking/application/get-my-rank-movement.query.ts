import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetMyRankMovementQuery } from '../domain/types/get-my-rank-movement.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type { RankMovementResponseDto } from '../dto/response/leaderboard-history.dto';

@Injectable()
export class GetMyRankMovementQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetMyRankMovementQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetMyRankMovementQuery): Promise<RankMovementResponseDto> {
    this.logger.debug({
      event: 'get_my_rank_movement',
      userId: query.userId,
      period: query.period,
    });

    const snapshots = await this.rankingRepository.getLatestRankSnapshots({
      userId: query.userId,
      period: query.period,
    });

    const currentRank = snapshots.current?.rank ?? null;
    const previousRank = snapshots.previous?.rank ?? null;

    if (currentRank === null) {
      return {
        previousRank: null,
        currentRank: null,
        change: null,
        direction: 'unknown',
      };
    }

    if (previousRank === null) {
      return {
        previousRank: null,
        currentRank,
        change: null,
        direction: 'unknown',
      };
    }

    const change = previousRank - currentRank;

    return {
      previousRank,
      currentRank,
      change,
      direction: this.getDirection(change),
    };
  }

  private getDirection(change: number): RankMovementResponseDto['direction'] {
    if (change > 0) {
      return 'up';
    }

    if (change < 0) {
      return 'down';
    }

    return 'stable';
  }
}
