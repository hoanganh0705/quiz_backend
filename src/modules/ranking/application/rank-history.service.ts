/**
 * Rank History Service
 *
 * Manages rank history records for archival and analytics.
 * Part of Phase 2 - Core Features.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort } from '../domain/ports/ranking-repository.port';
import { RankingPeriod } from '../domain/types/ranking.types';
import type { RankHistoryRow } from '../domain/ports/ranking-repository.port';

@Injectable()
export class RankHistoryService {
  constructor(
    @Inject('RANKING_REPOSITORY')
    private readonly rankingRepository: RankingRepositoryPort,
    @InjectPinoLogger(RankHistoryService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Archive a user's current ranking state.
   * Called before period resets or when storing snapshots.
   */
  async archiveRanking(params: {
    userId: string;
    period: RankingPeriod;
    periodStart: Date | null;
    periodEnd: Date;
    xpAtEnd: number;
    rankAtEnd: number | null;
  }): Promise<RankHistoryRow> {
    const { userId, period, periodStart, periodEnd, xpAtEnd, rankAtEnd } = params;

    // Get peak rank at end of period
    const peakRankField = this.getPeakRankField(period);
    const ranking = await this.rankingRepository.getUserRanking(userId);

    const peakRank = ranking?.[peakRankField] ?? null;
    const peakXp = xpAtEnd; // Peak XP is typically the final XP for a period

    return this.rankingRepository.createRankHistory({
      userId,
      period,
      periodStart,
      periodEnd,
      xpAtStart: 0, // Would need to track separately
      xpAtEnd,
      rankAtEnd,
      peakRank,
      peakXp,
    });
  }

  /**
   * Get rank history for a user.
   */
  async getUserRankHistory(
    userId: string,
    period: RankingPeriod,
    limit = 10,
  ): Promise<RankHistoryRow[]> {
    return this.rankingRepository.getRankHistory(userId, period, limit);
  }

  /**
   * Get all history for a specific period.
   * Useful for analytics and reporting.
   */
  async getPeriodHistory(
    period: RankingPeriod,
    limit = 100,
    offset = 0,
  ): Promise<RankHistoryRow[]> {
    // This would need a query method in the repository
    // For now, return empty
    return [];
  }

  /**
   * Calculate rank progression over time for a user.
   */
  async calculateRankProgression(
    userId: string,
    period: RankingPeriod,
  ): Promise<{
    currentRank: number | null;
    peakRank: number | null;
    rankChange: number | null;
    history: Array<{
      date: Date;
      rank: number | null;
    }>;
  }> {
    const history = await this.getUserRankHistory(userId, period, 52); // Last 52 weeks max

    const currentRanking = await this.rankingRepository.getUserRanking(userId);
    const rankField = this.getRankField(period);
    const currentRank = currentRanking?.[rankField] ?? null;

    const peakRankField = this.getPeakRankField(period);
    const peakRank = currentRanking?.[peakRankField] ?? null;

    // Calculate rank change from previous period
    const previousEntry = history[1]; // Most recent before current
    const rankChange = previousEntry?.rank !== undefined && currentRank !== null
      ? previousEntry.rank - currentRank
      : null;

    return {
      currentRank,
      peakRank,
      rankChange,
      history: history.map(h => ({
        date: new Date(h.createdAt),
        rank: h.rankAtEnd,
      })),
    };
  }

  /**
   * Get top movers for a period.
   * Users who improved the most in their rank.
   */
  async getTopMovers(period: RankingPeriod, limit = 10): Promise<{
    userId: string;
    previousRank: number | null;
    currentRank: number;
    improvement: number;
  }[]> {
    // This would require comparing current ranks with historical data
    // Simplified implementation
    return [];
  }

  private getRankField(period: RankingPeriod): 'allTimeRank' | 'weeklyRank' | 'monthlyRank' {
    const mapping: Record<RankingPeriod, 'allTimeRank' | 'weeklyRank' | 'monthlyRank'> = {
      [RankingPeriod.ALL_TIME]: 'allTimeRank',
      [RankingPeriod.WEEKLY]: 'weeklyRank',
      [RankingPeriod.MONTHLY]: 'monthlyRank',
    };
    return mapping[period];
  }

  private getPeakRankField(period: RankingPeriod): 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank' {
    const mapping: Record<RankingPeriod, 'peakAllTimeRank' | 'peakWeeklyRank' | 'peakMonthlyRank'> = {
      [RankingPeriod.ALL_TIME]: 'peakAllTimeRank',
      [RankingPeriod.WEEKLY]: 'peakWeeklyRank',
      [RankingPeriod.MONTHLY]: 'peakMonthlyRank',
    };
    return mapping[period];
  }
}
