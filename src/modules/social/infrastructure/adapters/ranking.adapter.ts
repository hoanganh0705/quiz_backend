/**
 * Ranking Adapter
 *
 * Implements RankingPort by delegating to Ranking module.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RANKING_REPOSITORY_PORT } from '@/modules/ranking/domain/ports/ranking-repository.port';
import type { RankingRepositoryPort } from '@/modules/ranking/domain/ports/ranking-repository.port';
import { RankingPeriod } from '@/modules/ranking/domain/types/ranking.types';
import { RankingEntry, RankingPort } from '../../domain/ports';

@Injectable()
export class RankingAdapter implements RankingPort {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(RankingAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  async getRankingsForUsers(
    userIds: string[],
    period: 'weekly' | 'monthly' | 'all_time',
  ): Promise<Map<string, RankingEntry>> {
    if (userIds.length === 0) {
      return new Map();
    }

    this.logger.debug({
      event: 'get_rankings_for_users',
      userIdsCount: userIds.length,
      period,
    });

    const rankingPeriod = this.mapToRankingPeriod(period);
    const results = new Map<string, RankingEntry>();

    // Get rankings for each user
    for (const userId of userIds) {
      const ranking = await this.rankingRepository.getUserRanking(userId);
      if (ranking) {
        const xp = this.getXpForPeriod(ranking, rankingPeriod);
        if (xp > 0) {
          results.set(userId, { userId, xp });
        }
      }
    }

    return results;
  }

  async getTotalParticipants(period: 'weekly' | 'monthly' | 'all_time'): Promise<number> {
    const rankingPeriod = this.mapToRankingPeriod(period);
    return this.rankingRepository.getTotalParticipants(rankingPeriod);
  }

  async getUserRank(
    userId: string,
    period: 'weekly' | 'monthly' | 'all_time',
  ): Promise<number | null> {
    const rankingPeriod = this.mapToRankingPeriod(period);
    return this.rankingRepository.getUserRank(userId, rankingPeriod);
  }

  private mapToRankingPeriod(period: 'weekly' | 'monthly' | 'all_time'): RankingPeriod {
    switch (period) {
      case 'weekly':
        return RankingPeriod.WEEKLY;
      case 'monthly':
        return RankingPeriod.MONTHLY;
      case 'all_time':
        return RankingPeriod.ALL_TIME;
    }
  }

  private getXpForPeriod(
    ranking: { weeklyXp: number; monthlyXp: number; allTimeXp: number },
    period: RankingPeriod,
  ): number {
    switch (period) {
      case RankingPeriod.WEEKLY:
        return ranking.weeklyXp;
      case RankingPeriod.MONTHLY:
        return ranking.monthlyXp;
      case RankingPeriod.ALL_TIME:
        return ranking.allTimeXp;
    }
  }
}
