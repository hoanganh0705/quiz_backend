/**
 * User Rank Service
 *
 * Handles user-specific rank queries and profiles.
 * Part of Phase 3 - Leaderboards & APIs.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort } from '../domain/ports/ranking-repository.port';
import {
  RankingPeriod,
  RANKING_CONSTANTS,
  calculatePercentile,
  getPercentileLabel,
  getXpField,
} from '../domain/types/ranking.types';
import { RankHistoryService } from './rank-history.service';
import { PeakRankService } from './peak-rank.service';
import type { RankingPeriodEnum } from '../dto/request/leaderboard-query.dto';
import type {
  UserRankResponseDto,
  GlobalRankingDto,
  PeakRanksDto,
  UserBadgesDto,
  UserRankSummaryDto,
} from '../dto/response/leaderboard-response.dto';

@Injectable()
export class UserRankService {
  constructor(
    @Inject('RANKING_REPOSITORY')
    private readonly rankingRepository: RankingRepositoryPort,
    private readonly rankHistoryService: RankHistoryService,
    private readonly peakRankService: PeakRankService,
    @InjectPinoLogger(UserRankService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get complete user rank information.
   */
  async getUserRank(userId: string): Promise<UserRankResponseDto> {
    this.logger.debug({
      event: 'get_user_rank',
      userId,
    });

    const ranking = await this.rankingRepository.getUserRanking(userId);

    if (!ranking) {
      // Return empty rank response for users without ranking
      return this.buildEmptyRankResponse();
    }

    // Get global rankings for all periods
    const global = await this.buildGlobalRanking(ranking.userId);

    // Get peak ranks
    const peakRanks = await this.peakRankService.getPeakRankInfo(userId);

    // Get user badges
    const badges = await this.buildUserBadges(ranking);

    return {
      global,
      peakRanks: this.buildPeakRanksDto(peakRanks),
      lastActivityAt: ranking.lastActivityAt,
      badges,
    };
  }

  /**
   * Get user rank for a specific period.
   */
  async getUserRankForPeriod(
    userId: string,
    periodEnum: RankingPeriodEnum,
  ): Promise<UserRankSummaryDto | undefined> {
    const period = this.enumToPeriod(periodEnum);

    const ranking = await this.rankingRepository.getUserRanking(userId);
    if (!ranking) return undefined;

    const xpField = getXpField(period);
    const xp = ranking[xpField];

    if (xp === 0) return undefined;

    // Get rank
    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return undefined;

    // Get total participants
    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);

    // Get XP to next rank
    const nextRankXp = await this.rankingRepository.getNextRankXp(period, rank);
    const xpToNextRank = nextRankXp !== null ? nextRankXp - xp : null;

    return {
      rank,
      denseRank: rank,
      percentile,
      percentileLabel: getPercentileLabel(percentile),
      xp,
      xpToNextRank,
      nextRankXp,
      trend: 'same', // Simplified
      trendAmount: null,
      period: periodEnum,
      resetInSeconds: 0, // Would calculate from period reset service
    };
  }

  /**
   * Get rank for a specific user (public endpoint).
   */
  async getPublicUserRank(userId: string): Promise<{
    rank: number;
    period: RankingPeriod;
    xp: number;
    displayName: string;
  } | null> {
    const rankingWithUser = await this.rankingRepository.getUserRankingWithUser(userId);

    if (!rankingWithUser) return null;

    return {
      rank: rankingWithUser.allTimeRank ?? 0,
      period: RankingPeriod.ALL_TIME,
      xp: rankingWithUser.allTimeXp,
      displayName: rankingWithUser.displayName || rankingWithUser.username,
    };
  }

  /**
   * Build global ranking for all periods.
   */
  private async buildGlobalRanking(userId: string): Promise<GlobalRankingDto> {
    const [weekly, monthly, allTime] = await Promise.all([
      this.getRankInfoForPeriod(userId, RankingPeriod.WEEKLY),
      this.getRankInfoForPeriod(userId, RankingPeriod.MONTHLY),
      this.getRankInfoForPeriod(userId, RankingPeriod.ALL_TIME),
    ]);

    return { weekly, monthly, allTime };
  }

  /**
   * Get rank info for a specific period.
   */
  private async getRankInfoForPeriod(
    userId: string,
    period: RankingPeriod,
  ): Promise<GlobalRankingDto['weekly']> {
    const ranking = await this.rankingRepository.getUserRanking(userId);
    if (!ranking) return null;

    const xpField = getXpField(period);
    const xp = ranking[xpField];

    if (xp === 0) return null;

    // Get rank
    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return null;

    // Get total participants
    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);

    // Get XP to next rank
    const nextRankXp = await this.rankingRepository.getNextRankXp(period, rank);
    const xpToNextRank = nextRankXp !== null ? nextRankXp - xp : null;

    // Determine trend
    const trend = await this.getRankTrend(userId, period, rank);

    return {
      rank,
      denseRank: rank,
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
   * Get rank trend by comparing with historical data.
   */
  private async getRankTrend(
    userId: string,
    period: RankingPeriod,
    currentRank: number,
  ): Promise<'up' | 'down' | 'same' | 'new'> {
    try {
      const history = await this.rankHistoryService.getUserRankHistory(userId, period, 2);

      if (history.length === 0) return 'new';

      const previousEntry = history[0]; // Most recent historical entry
      if (!previousEntry || previousEntry.rankAtEnd === null) return 'new';

      const previousRank = previousEntry.rankAtEnd;
      const change = previousRank - currentRank;

      if (change > 0) return 'up';
      if (change < 0) return 'down';
      return 'same';
    } catch {
      return 'new';
    }
  }

  /**
   * Build user badges based on activity and rank.
   */
  private async buildUserBadges(ranking: {
    lastActivityAt: string | null;
    createdAt?: never;
  }): Promise<UserBadgesDto> {
    const now = new Date();
    const lastActivity = ranking.lastActivityAt ? new Date(ranking.lastActivityAt) : null;

    // Check if new user (7 days)
    const userCreatedAt = new Date(); // Would need to join with users table
    const daysSinceCreation = lastActivity
      ? Math.floor((now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : RANKING_CONSTANTS.NEW_USER_GRACE_DAYS + 1;

    const isNew = daysSinceCreation <= RANKING_CONSTANTS.NEW_USER_GRACE_DAYS;

    // Check if active (activity in last 7 days)
    const isActive =
      lastActivity !== null &&
      now.getTime() - lastActivity.getTime() < 7 * 24 * 60 * 60 * 1000;

    // Rising star = top weekly gainer (would need separate calculation)
    const isRisingStar = false;

    return {
      isNew,
      isRisingStar,
      isActive,
    };
  }

  /**
   * Build peak ranks DTO.
   */
  private buildPeakRanksDto(peakRanks: {
    weekly: number | null;
    monthly: number | null;
    allTime: number | null;
  }): PeakRanksDto {
    return {
      weekly: peakRanks.weekly,
      monthly: peakRanks.monthly,
      allTime: peakRanks.allTime,
    };
  }

  /**
   * Build empty rank response.
   */
  private buildEmptyRankResponse(): UserRankResponseDto {
    return {
      global: {
        weekly: null,
        monthly: null,
        allTime: null,
      },
      peakRanks: {
        weekly: null,
        monthly: null,
        allTime: null,
      },
      lastActivityAt: null,
      badges: {
        isNew: true,
        isRisingStar: false,
        isActive: false,
      },
    };
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
