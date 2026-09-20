/**
 * Ranking Adapter
 *
 * Implements RankingPort by delegating to the Ranking repository through the
 * `RANKING_REPOSITORY_PORT` token. The repository instance lives in RankingModule
 * and is shared across all consumers — Social does not own or instantiate it.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
  type RankSnapshotPairRow,
} from '@/modules/ranking/domain/ports/ranking-repository.port';
import { RankingPeriod } from '@/modules/ranking/domain/types/ranking.types';
import {
  RankingEntry,
  RankingPort,
  type RankTrend,
  type RankTrendDirection,
} from '../../domain/ports';

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

    const rankings = await this.rankingRepository.getRankingsForUsers(userIds);
    for (const ranking of rankings) {
      const xp = this.getXpForPeriod(ranking, rankingPeriod);
      if (xp > 0) {
        results.set(ranking.userId, { userId: ranking.userId, xp });
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

  async getRankTrendsForUsers(
    userIds: string[],
    periods: Array<'weekly' | 'monthly' | 'all_time'>,
  ): Promise<Map<string, RankTrend[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    this.logger.debug({
      event: 'get_rank_trends_for_users',
      userIdsCount: userIds.length,
      periods,
    });

    const results = new Map<string, RankTrend[]>();

    const currentRankings = await this.rankingRepository.getRankingsForUsers(userIds);
    const currentRankingsByUser = new Map(currentRankings.map((r) => [r.userId, r]));

    const uniquePeriods = Array.from(new Set(periods));
    const snapshotsByUserPeriod = new Map<string, RankSnapshotPairRow>();
    await Promise.all(
      userIds.flatMap((userId) =>
        uniquePeriods.map(async (period) => {
          const rankingPeriod = this.mapToRankingPeriod(period);
          const snapshots = await this.rankingRepository.getLatestRankSnapshots({
            userId,
            period: rankingPeriod,
          });
          snapshotsByUserPeriod.set(`${userId}:${period}`, snapshots);
        }),
      ),
    );

    for (const userId of userIds) {
      const currentRanking = currentRankingsByUser.get(userId);
      const trends = uniquePeriods.map((period) => {
        const rankingPeriod = this.mapToRankingPeriod(period);
        const currentXp = currentRanking ? this.getXpForPeriod(currentRanking, rankingPeriod) : 0;
        const rankField =
          rankingPeriod === RankingPeriod.WEEKLY
            ? currentRanking?.weeklyRank
            : rankingPeriod === RankingPeriod.MONTHLY
              ? currentRanking?.monthlyRank
              : currentRanking?.allTimeRank;
        const currentRank = rankField ?? null;

        const snapshots = snapshotsByUserPeriod.get(`${userId}:${period}`) ?? null;
        const previousRank = snapshots?.previous?.rank ?? null;
        const previousXp = snapshots?.previous?.xp ?? null;

        const change =
          previousRank !== null && currentRank !== null ? previousRank - currentRank : 0;

        const direction: RankTrendDirection =
          previousRank === null && currentRank !== null
            ? 'new'
            : currentRank === null
              ? 'stable'
              : change > 0
                ? 'up'
                : change < 0
                  ? 'down'
                  : 'stable';

        return {
          period,
          currentRank,
          previousRank,
          change,
          direction,
          currentXp,
          previousXp,
        } satisfies RankTrend;
      });
      results.set(userId, trends);
    }

    return results;
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
      case RankingPeriod.DAILY:
        return ranking.allTimeXp;
    }
  }
}
