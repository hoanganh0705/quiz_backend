/**
 * User Rank Service
 *
 * Handles user-specific rank queries and profiles.
 * Part of Phase 3 - Leaderboards & APIs.
 *
 * Architecture Note: This service contains core ranking read logic.
 * Badge calculations are delegated to Achievement domain via ACHIEVEMENT_PORT.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../ports/ranking-repository.port';
import {
  RankingPeriod,
  calculatePercentile,
  getPercentileLabel,
  getXpField,
  enumToPeriod,
} from '../types/ranking.types';
import { LeaderboardPeriodEnum, RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type {
  UserRankResponseDto,
  GlobalRankingDto,
  PeakRankDto,
  PeakRanksResponseDto,
  UserBadgesDto,
  UserRankSummaryDto,
} from '../../dto';
import { PeriodResetService } from './period-reset.service';

@Injectable()
export class UserRankService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    private readonly periodResetService: PeriodResetService,
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
      return this.buildEmptyRankResponse();
    }

    const global = await this.buildGlobalRanking(ranking.userId);
    const peakRanks = this.getPeakRankInfo(ranking);
    const badges = this.getBasicBadges(ranking);

    return {
      global,
      peakRanks,
      lastActivityAt: ranking.lastActivityAt,
      badges,
    };
  }

  async getMyPeakRanks(userId: string): Promise<PeakRanksResponseDto> {
    this.logger.debug({
      event: 'get_my_peak_ranks_from_service',
      userId,
    });

    const peakRanks = await this.rankingRepository.getPeakRanks(userId);

    return {
      daily: this.toPeakRankDto(peakRanks.daily.rank, peakRanks.daily.achievedAt),
      weekly: this.toPeakRankDto(peakRanks.weekly.rank, peakRanks.weekly.achievedAt),
      monthly: this.toPeakRankDto(peakRanks.monthly.rank, peakRanks.monthly.achievedAt),
      allTime: this.toPeakRankDto(peakRanks.allTime.rank, peakRanks.allTime.achievedAt),
    };
  }

  /**
   * Get user rank for a specific period.
   */
  async getUserRankForPeriod(
    userId: string,
    periodEnum: RankingPeriodEnum | LeaderboardPeriodEnum,
  ): Promise<UserRankSummaryDto | undefined> {
    const period = enumToPeriod(periodEnum);

    const ranking = await this.rankingRepository.getUserRanking(userId);
    if (!ranking) return undefined;

    const xpField = getXpField(period);
    const xp = ranking[xpField];

    if (xp === 0) return undefined;

    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return undefined;

    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);

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
      trend: 'same',
      trendAmount: null,
      period: this.toPeriodValue(period),
      resetInSeconds: this.computeResetInSeconds(period),
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

    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return null;

    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);

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
      trend: 'same',
      trendAmount: null,
    };
  }

  /**
   * Get peak rank info (inlined from peak-rank service).
   *
   * Aligned with the `/leaderboard/me/peak-ranks` response shape so the two
   * surfaces expose the same data structure (rank + achievedAt). Daily is
   * included here because `user_ranking` tracks `peak_daily_rank` and
   * `peak_daily_rank_achieved_at` even though daily leaderboards are not
   * publicly queryable yet.
   */
  private getPeakRankInfo(ranking: {
    peakDailyRank: number | null;
    peakDailyRankAchievedAt: string | null;
    peakWeeklyRank: number | null;
    peakWeeklyRankAchievedAt: string | null;
    peakMonthlyRank: number | null;
    peakMonthlyRankAchievedAt: string | null;
    peakAllTimeRank: number | null;
    peakAllTimeRankAchievedAt: string | null;
  }): PeakRanksResponseDto {
    return {
      daily: this.toPeakRankDto(ranking.peakDailyRank, ranking.peakDailyRankAchievedAt),
      weekly: this.toPeakRankDto(ranking.peakWeeklyRank, ranking.peakWeeklyRankAchievedAt),
      monthly: this.toPeakRankDto(ranking.peakMonthlyRank, ranking.peakMonthlyRankAchievedAt),
      allTime: this.toPeakRankDto(ranking.peakAllTimeRank, ranking.peakAllTimeRankAchievedAt),
    };
  }

  private toPeakRankDto(rank: number | null, achievedAt: string | null): PeakRankDto | null {
    if (rank === null) {
      return null;
    }

    return {
      rank,
      achievedAt,
    };
  }

  /**
   * Get basic badges (simplified).
   * Full badge logic should be via ACHIEVEMENT_PORT.
   */
  private getBasicBadges(ranking: { lastActivityAt: string | null }): UserBadgesDto {
    const now = new Date();
    const lastActivity = ranking.lastActivityAt ? new Date(ranking.lastActivityAt) : null;

    // Simplified badge calculation
    const isActive =
      lastActivity !== null && now.getTime() - lastActivity.getTime() < 7 * 24 * 60 * 60 * 1000;

    return {
      isNew: false, // Requires user creation date
      isRisingStar: false, // Requires ACHIEVEMENT_PORT
      isActive,
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
        daily: null,
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
   * Map a domain `RankingPeriod` to the public wire value advertised by
   * `UserRankSummaryDto.period`. Mirrors the same labels used by
   * `LeaderboardResponseDto.period.type` and `PeriodInfoDto.type`.
   */
  private toPeriodValue(period: RankingPeriod): UserRankSummaryDto['period'] {
    switch (period) {
      case RankingPeriod.WEEKLY:
        return 'weekly';
      case RankingPeriod.MONTHLY:
        return 'monthly';
      case RankingPeriod.ALL_TIME:
        return 'all_time';
      case RankingPeriod.DAILY:
      default:
        return 'all_time';
    }
  }

  /**
   * Seconds until the next period reset for the supplied period.
   * Returns 0 for `all_time` because there is no reset schedule.
   */
  private computeResetInSeconds(period: RankingPeriod): number {
    if (period === RankingPeriod.ALL_TIME) {
      return 0;
    }

    const now = new Date();
    const nextReset = this.periodResetService.getNextResetTime(period, now);

    return Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));
  }
}
