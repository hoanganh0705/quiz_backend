import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetTopMoversQuery } from '../domain/types/get-top-movers.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type { TopMoversResponseDto } from '../dto/response/leaderboard-top-movers.dto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const LEADERBOARD_TOP_MOVERS_CACHE_TTL_MS = 60_000;

@Injectable()
export class GetTopMoversQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @InjectPinoLogger(GetTopMoversQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetTopMoversQuery): Promise<TopMoversResponseDto> {
    this.logger.debug({
      event: 'get_top_movers',
      period: query.period,
      limit: query.limit,
    });

    const cacheKey = `leaderboard:top-movers:${query.period}:${query.limit}`;
    return this.cache.getOrSetWithStampedeProtection<TopMoversResponseDto>(
      cacheKey,
      LEADERBOARD_TOP_MOVERS_CACHE_TTL_MS,
      async () => {
        const items = await this.rankingRepository.getTopMovers({
          period: query.period,
          limit: query.limit,
        });
        return { items };
      },
      5_000,
      50,
      10,
    );
  }
}
