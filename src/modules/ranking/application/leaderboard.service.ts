/**
 * Leaderboard Service
 *
 * Handles leaderboard queries with caching.
 * Part of Phase 3 - Leaderboards & APIs.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort, LeaderboardRow } from '../domain/ports/ranking-repository.port';
import {
  RankingPeriod,
  RANKING_CONSTANTS,
  calculatePercentile,
  getPercentileLabel,
  getXpField,
} from '../domain/types/ranking.types';
import type { PeriodInfo } from '../domain/types/ranking.types';
import { PeriodResetService } from './period-reset.service';
import type { RankingPeriodEnum } from '../dto/request/leaderboard-query.dto';
import type {
  LeaderboardResponseDto,
  LeaderboardEntryDto,
  PeriodInfoDto,
  UserRankPositionDto,
} from '../dto/response/leaderboard-response.dto';

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject('RANKING_REPOSITORY')
    private readonly rankingRepository: RankingRepositoryPort,
    private readonly periodResetService: PeriodResetService,
    @InjectPinoLogger(LeaderboardService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get global leaderboard for a specific period.
   */
  async getGlobalLeaderboard(params: {
    period: RankingPeriodEnum;
    limit: number;
    offset: number;
    currentUserId?: string;
  }): Promise<LeaderboardResponseDto> {
    const { period: periodEnum, limit, offset, currentUserId } = params;
    const period = this.enumToPeriod(periodEnum);

    this.logger.debug({
      event: 'get_global_leaderboard',
      period,
      limit,
      offset,
    });

    // Query leaderboard
    const entries = await this.rankingRepository.getLeaderboard({
      period,
      limit,
      offset,
    });

    // Get total participants
    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);

    // Transform entries
    const leaderboardEntries = this.transformLeaderboardEntries(entries, offset, currentUserId);

    // Get current user's position if authenticated
    let userPosition: UserRankPositionDto | undefined;
    if (currentUserId) {
      userPosition = await this.getUserPosition(currentUserId, period);
    }

    // Build period info
    const periodInfo = this.buildPeriodInfo(period);

    // Build pagination info
    const pagination = {
      limit,
      offset,
      hasMore: offset + entries.length < totalParticipants,
    };

    return {
      entries: leaderboardEntries,
      totalParticipants,
      userPosition,
      period: periodInfo,
      pagination,
    };
  }

  /**
   * Get user position for a specific period.
   */
  async getUserPosition(userId: string, periodEnum: RankingPeriodEnum): Promise<UserRankPositionDto | undefined> {
    const period = this.enumToPeriod(periodEnum);

    const ranking = await this.rankingRepository.getUserRanking(userId);
    if (!ranking) return undefined;

    const xpField = getXpField(period);
    const xp = ranking[xpField];

    if (xp === 0) return undefined;

    // Get stored rank
    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return undefined;

    // Get dense rank
    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);

    // Get XP to next rank
    const nextRankXp = await this.rankingRepository.getNextRankXp(period, rank);
    const xpToNextRank = nextRankXp !== null ? nextRankXp - xp : null;

    // Determine trend (simplified - would need rank history for accurate trend)
    const trend = this.determineTrend(ranking);

    return {
      rank,
      denseRank: rank, // Same as rank for now, DENSE_RANK() calculated separately
      percentile,
      percentileLabel: getPercentileLabel(percentile),
      xp,
      xpToNextRank,
      nextRankXp,
      trend,
      trendAmount: null,
    };
  }

  /**
   * Get period information including reset time.
   */
  async getPeriodInfo(periodEnum: RankingPeriodEnum): Promise<PeriodInfoDto> {
    const period = this.enumToPeriod(periodEnum);
    return this.buildPeriodInfo(period);
  }

  /**
   * Transform database entries to DTOs with tie detection.
   */
  private transformLeaderboardEntries(
    entries: LeaderboardRow[],
    offset: number,
    currentUserId?: string,
  ): LeaderboardEntryDto[] {
    const leaderboardEntries: LeaderboardEntryDto[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const displayRank = offset + i + 1;

      // Check for tie with previous entry
      const prevEntry = i > 0 ? entries[i - 1] : null;
      const isTied = prevEntry !== null && entry.xp === prevEntry.xp;

      leaderboardEntries.push({
        rank: entry.rank, // RANK() value
        denseRank: entry.denseRank, // DENSE_RANK() value
        userId: entry.userId,
        displayName: entry.displayName || entry.username,
        avatarUrl: entry.avatarUrl,
        xp: entry.xp,
        isTied,
        isCurrentUser: currentUserId === entry.userId,
      });
    }

    return leaderboardEntries;
  }

  /**
   * Build period info including reset countdown.
   */
  private buildPeriodInfo(period: RankingPeriod): PeriodInfoDto {
    const now = new Date();
    const nextReset = this.periodResetService.getNextResetTime(period, now);
    const resetInSeconds = Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));

    // Calculate period start
    let start: Date;
    let end: Date | null = null;

    switch (period) {
      case RankingPeriod.WEEKLY: {
        // Start of current week (Monday)
        const day = now.getUTCDay();
        const diff = (day === 0 ? -6 : 1 - day);
        start = new Date(now);
        start.setUTCDate(now.getUTCDate() + diff);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        end.setUTCMilliseconds(end.getMilliseconds() - 1);
        break;
      }
      case RankingPeriod.MONTHLY: {
        // Start of current month
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        // End of current month
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        break;
      }
      case RankingPeriod.ALL_TIME:
      default:
        // No start for all-time
        start = new Date(0); // Epoch
        end = null;
        break;
    }

    return {
      type: period as 'weekly' | 'monthly' | 'all_time',
      start: start.toISOString(),
      end: end?.toISOString() ?? null,
      resetInSeconds,
    };
  }

  /**
   * Determine rank trend (simplified).
   */
  private determineTrend(ranking: {
    weeklyRank: number | null;
    monthlyRank: number | null;
    allTimeRank: number | null;
  }): 'up' | 'down' | 'same' | 'new' {
    // Simplified - would need historical data for accurate trend
    // For now, return 'new' if no rank, 'same' otherwise
    if (ranking.allTimeRank === null) return 'new';
    return 'same';
  }

  /**
   * Convert enum to domain period.
   */
  private enumToPeriod(periodEnum: RankingPeriodEnum): RankingPeriod {
    const mapping: Record<RankingPeriodEnum, RankingPeriod> = {
      [RankingPeriodEnum.WEEKLY]: RankingPeriod.WEEKLY,
      [RankingPeriodEnum.MONTHLY]: RankingPeriod.MONTHLY,
      [RankingPeriodEnum.ALL_TIME]: RankingPeriod.ALL_TIME,
    };
    return mapping[periodEnum];
  }
}
