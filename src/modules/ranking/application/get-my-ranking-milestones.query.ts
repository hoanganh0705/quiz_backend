import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { GetMyRankingMilestonesQuery } from '../domain/types/get-my-ranking-milestones.query';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../domain/ports/ranking-repository.port';
import type {
  RankingMilestoneDto,
  RankingMilestonesResponseDto,
} from '../dto/response/leaderboard-response.dto';

@Injectable()
export class GetMyRankingMilestonesQueryHandler {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(GetMyRankingMilestonesQueryHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(query: GetMyRankingMilestonesQuery): Promise<RankingMilestonesResponseDto> {
    this.logger.debug({
      event: 'get_my_ranking_milestones',
      userId: query.userId,
    });

    const items = await this.rankingRepository.getUserMilestones(query.userId);

    return {
      items: items.map((item) => this.toDto(item)),
    };
  }

  private toDto(item: {
    milestone: RankingMilestoneDto['milestone'];
    rank: number;
    achievedAt: string;
  }): RankingMilestoneDto {
    return {
      milestone: item.milestone,
      rank: item.rank,
      achievedAt: item.achievedAt,
    };
  }
}
