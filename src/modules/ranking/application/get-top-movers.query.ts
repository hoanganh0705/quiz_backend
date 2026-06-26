import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetTopMoversQuery } from '../domain/types/get-top-movers.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type { TopMoversResponseDto } from '../dto/response/leaderboard-top-movers.dto';

@Injectable()
export class GetTopMoversQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetTopMoversQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetTopMoversQuery): Promise<TopMoversResponseDto> {
    this.logger.debug({
      event: 'get_top_movers',
      period: query.period,
      limit: query.limit,
    });

    const items = await this.rankingRepository.getTopMovers({
      period: query.period,
      limit: query.limit,
    });

    return { items };
  }
}
