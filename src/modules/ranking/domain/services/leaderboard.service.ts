import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort, LeaderboardRow } from '../ports/ranking-repository.port';
import {
  RankingPeriod,
  RANKING_CONSTANTS,
  calculatePercentile,
  getPercentileLabel,
  getXpField,
  enumToPeriod,
} from '../types/ranking.types';
import { RANKING_REPOSITORY_PORT } from '../ports/ranking-repository.port';
import { PeriodResetService } from './period-reset.service';
import { LeaderboardPeriodEnum, RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type {
  LeaderboardResponseDto,
  LeaderboardEntryDto,
  PeriodInfoDto,
  UserRankPositionDto,
} from '../../dto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

@Injectable()
export class LeaderboardService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    private readonly periodResetService: PeriodResetService,
    @InjectPinoLogger(LeaderboardService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get global leaderboard for a specific period.
   */
  async getGlobalLeaderboard(params: {
    period: RankingPeriodEnum | LeaderboardPeriodEnum;
    limit: number;
    offset: number;
    currentUserId?: string;
  }): Promise<LeaderboardResponseDto> {
    const { period: periodEnum, limit, offset, currentUserId } = params;
    const period = enumToPeriod(periodEnum);

    const cacheKey = `lb:${period}:${limit}:${offset}`;
    const ttlMs = RANKING_CONSTANTS.LEADERBOARD_CACHE_TTL * 1000;

    const cachedPayload = await this.cache.getOrSetWithStampedeProtection<{
      entries: LeaderboardEntryDto[];
      totalParticipants: number;
    }>(cacheKey, ttlMs, async () => {
      this.logger.debug({
        event: 'get_global_leaderboard',
        period,
        limit,
        offset,
      });
      const entries = await this.rankingRepository.getLeaderboard({
        period,
        limit,
        offset,
      });
      const totalParticipants = await this.getCachedTotalParticipants(period);
      return {
        entries: this.transformLeaderboardEntries(entries, offset),
        totalParticipants,
      };
    });

    let userPosition: UserRankPositionDto | null = null;
    if (currentUserId) {
      userPosition = (await this.getUserPosition(currentUserId, periodEnum)) ?? null;
    }

    return {
      entries: cachedPayload.entries,
      totalParticipants: cachedPayload.totalParticipants,
      userPosition,
      period: this.buildPeriodInfo(period),
      pagination: {
        limit,
        offset,
        hasMore: offset + cachedPayload.entries.length < cachedPayload.totalParticipants,
      },
    };
  }

  async getGlobalLeaderboardCursor(params: {
    period: RankingPeriodEnum | LeaderboardPeriodEnum;
    limit: number;
    cursorXp?: number | null;
    cursorCreatedAt?: string | null;
    cursorUserId?: string | null;
    currentUserId?: string;
  }): Promise<LeaderboardResponseDto> {
    const { period: periodEnum, limit, currentUserId } = params;
    const period = enumToPeriod(periodEnum);

    const hasCursor =
      params.cursorXp !== null &&
      params.cursorXp !== undefined &&
      params.cursorCreatedAt !== null &&
      params.cursorCreatedAt !== undefined &&
      params.cursorUserId !== null &&
      params.cursorUserId !== undefined;

    const entries = hasCursor
      ? await this.rankingRepository.getLeaderboardKeyset({
          period,
          limit,
          cursorXp: params.cursorXp ?? null,
          cursorCreatedAt: params.cursorCreatedAt ?? null,
          cursorUserId: params.cursorUserId ?? null,
        })
      : await this.rankingRepository.getLeaderboardCursorFirstPage({ period, limit });

    let userPosition: UserRankPositionDto | null = null;
    if (currentUserId) {
      userPosition = (await this.getUserPosition(currentUserId, periodEnum)) ?? null;
    }

    const lastEntry = entries[entries.length - 1];
    const nextCursor =
      entries.length === limit && lastEntry
        ? {
            xp: Number(lastEntry.xp),
            createdAt:
              (lastEntry as LeaderboardRow & { createdAt?: string }).createdAt ??
              new Date().toISOString(),
            userId: lastEntry.userId,
          }
        : null;

    return {
      entries: this.transformLeaderboardEntries(entries, 0),
      totalParticipants: await this.getCachedTotalParticipants(period),
      userPosition,
      period: this.buildPeriodInfo(period),
      pagination: {
        limit,
        offset: 0,
        hasMore: nextCursor !== null,
        cursor: nextCursor ?? undefined,
      },
    };
  }

  /**
   * Get user position for a specific period.
   */
  getUserPosition(
    userId: string,
    periodEnum: RankingPeriodEnum | LeaderboardPeriodEnum,
  ): Promise<UserRankPositionDto | undefined> {
    const period = enumToPeriod(periodEnum);

    const cacheKey = `pos:${userId}:${period}`;
    const ttlMs = RANKING_CONSTANTS.USER_RANK_CACHE_TTL * 1000;

    // Use stampede protection for user position queries
    return this.cache
      .getOrSetWithStampedeProtection<UserRankPositionDto | null>(cacheKey, ttlMs, async () => {
        this.logger.debug({ event: 'get_user_position', userId, period });
        const ranking = await this.rankingRepository.getUserRanking(userId);
        if (!ranking) return null;

        const xpField = getXpField(period);
        const xp = ranking[xpField];

        if (xp === 0) return null;

        const rank = await this.rankingRepository.getUserRank(userId, period);
        if (rank === null) return null;

        // Fetch rank history for trend calculation
        const snapshots = await this.rankingRepository.getLatestRankSnapshots({
          userId,
          period: RankingPeriod.ALL_TIME,
        });

        const totalParticipants = await this.getCachedTotalParticipants(period);
        const percentile = calculatePercentile(rank, totalParticipants);
        const nextRankXp = await this.rankingRepository.getNextRankXp(period, rank);
        const xpToNextRank = nextRankXp !== null ? nextRankXp - xp : null;
        const trend = this.determineTrendWithSnapshots(rank, snapshots);
        const trendAmount = this.calculateTrendAmount(rank, snapshots);

        return {
          rank,
          denseRank: rank,
          percentile,
          percentileLabel: getPercentileLabel(percentile),
          xp,
          xpToNextRank,
          nextRankXp,
          trend,
          trendAmount,
        };
      })
      .then((value) => value ?? undefined);
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

      const prevEntry = i > 0 ? entries[i - 1] : null;
      const isTied = prevEntry !== null && entry.xp === prevEntry.xp;

      leaderboardEntries.push({
        rank: entry.rank,
        denseRank: entry.denseRank,
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

    let start: Date;
    let end: Date | null = null;

    switch (period) {
      case RankingPeriod.DAILY: {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        break;
      }
      case RankingPeriod.WEEKLY: {
        const day = now.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        start = new Date(now);
        start.setUTCDate(now.getUTCDate() + diff);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        break;
      }
      case RankingPeriod.MONTHLY: {
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        break;
      }
      case RankingPeriod.ALL_TIME:
      default:
        start = new Date(0);
        end = null;
        break;
    }

    return {
      type: period as 'daily' | 'weekly' | 'monthly' | 'all_time',
      start: start.toISOString(),
      end: end?.toISOString() ?? null,
      resetInSeconds,
    };
  }

  /**
   * Determine the user's rank trend by comparing current rank to previous rank.
   *
   * Trend calculation:
   * - 'new': User has no all-time rank (first time appearing in leaderboard)
   * - 'up': Current rank is better (lower number) than previous rank
   * - 'down': Current rank is worse (higher number) than previous rank
   * - 'same': Rank hasn't changed
   *
   * Uses the rank history snapshots to compare current rank with the most recent
   * snapshot to determine the direction of rank movement.
   */
  private determineTrendWithSnapshots(
    currentRank: number,
    snapshots: { current: { rank: number } | null; previous: { rank: number } | null },
  ): 'up' | 'down' | 'same' | 'new' {
    const previousSnapshot = snapshots.previous;
    if (!previousSnapshot) {
      return 'new';
    }

    const previousRank = previousSnapshot.rank;
    if (currentRank < previousRank) {
      return 'up';
    } else if (currentRank > previousRank) {
      return 'down';
    }
    return 'same';
  }

  /**
   * Calculate the absolute rank change amount.
   * Returns null if no previous snapshot exists.
   */
  private calculateTrendAmount(
    currentRank: number,
    snapshots: { current: { rank: number } | null; previous: { rank: number } | null },
  ): number | null {
    const previousSnapshot = snapshots.previous;
    if (!previousSnapshot) {
      return null;
    }
    return previousSnapshot.rank - currentRank;
  }

  private getCachedTotalParticipants(period: RankingPeriod): Promise<number> {
    const cacheKey = `total:${period}`;
    const ttlMs = RANKING_CONSTANTS.TOTAL_USERS_CACHE_TTL * 1000;

    // Use stampede protection for total participants count
    return this.cache.getOrSetWithStampedeProtection<number>(cacheKey, ttlMs, async () => {
      this.logger.debug({ event: 'get_total_participants', period });
      return this.rankingRepository.getTotalParticipants(period);
    });
  }
}
