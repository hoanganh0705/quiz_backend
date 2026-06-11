/**
 * Leaderboard Service
 *
 * Handles leaderboard queries with caching.
 * Part of Phase 3 - Leaderboards & APIs.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort, LeaderboardRow } from '../ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../ports/ranking-event-bus.port';
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
import { RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';
import type {
  LeaderboardResponseDto,
  LeaderboardEntryDto,
  PeriodInfoDto,
  UserRankPositionDto,
} from '../../dto/response/leaderboard-response.dto';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class LeaderboardService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    private readonly periodResetService: PeriodResetService,
    @InjectPinoLogger(LeaderboardService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      if (event.eventType === 'xp.added') {
        this.invalidateUserCache(event.userId);
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.cache.clear();
  }

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
    const period = enumToPeriod(periodEnum);

    const cacheKey = `lb:${period}:${limit}:${offset}`;
    const cached = this.getCached<{
      entries: LeaderboardEntryDto[];
      totalParticipants: number;
    }>(cacheKey);
    if (cached) {
      this.logger.debug({ event: 'leaderboard_cache_hit', period, limit, offset });
      const { entries: cachedEntries, totalParticipants } = cached;
      let userPosition: UserRankPositionDto | undefined;
      if (currentUserId) {
        userPosition = await this.getUserPosition(currentUserId, periodEnum);
      }
      return {
        entries: cachedEntries,
        totalParticipants,
        userPosition,
        period: this.buildPeriodInfo(period),
        pagination: {
          limit,
          offset,
          hasMore: offset + cachedEntries.length < totalParticipants,
        },
      };
    }

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
    const leaderboardEntries = this.transformLeaderboardEntries(entries, offset, currentUserId);

    this.setCached(cacheKey, { entries: leaderboardEntries, totalParticipants }, RANKING_CONSTANTS.LEADERBOARD_CACHE_TTL);

    let userPosition: UserRankPositionDto | undefined;
    if (currentUserId) {
      userPosition = await this.getUserPosition(currentUserId, periodEnum);
    }

    return {
      entries: leaderboardEntries,
      totalParticipants,
      userPosition,
      period: this.buildPeriodInfo(period),
      pagination: {
        limit,
        offset,
        hasMore: offset + entries.length < totalParticipants,
      },
    };
  }

  /**
   * Get user position for a specific period.
   */
  async getUserPosition(
    userId: string,
    periodEnum: RankingPeriodEnum,
  ): Promise<UserRankPositionDto | undefined> {
    const period = enumToPeriod(periodEnum);

    const cacheKey = `pos:${userId}:${period}`;
    const cached = this.getCached<UserRankPositionDto>(cacheKey);
    if (cached) {
      this.logger.debug({ event: 'user_position_cache_hit', userId, period });
      return cached;
    }

    const ranking = await this.rankingRepository.getUserRanking(userId);
    if (!ranking) return undefined;

    const xpField = getXpField(period);
    const xp = ranking[xpField];

    if (xp === 0) return undefined;

    const rank = await this.rankingRepository.getUserRank(userId, period);
    if (rank === null) return undefined;

    const totalParticipants = await this.getCachedTotalParticipants(period);
    const percentile = calculatePercentile(rank, totalParticipants);
    const nextRankXp = await this.rankingRepository.getNextRankXp(period, rank);
    const xpToNextRank = nextRankXp !== null ? nextRankXp - xp : null;

    const result: UserRankPositionDto = {
      rank,
      denseRank: rank,
      percentile,
      percentileLabel: getPercentileLabel(percentile),
      xp,
      xpToNextRank,
      nextRankXp,
      trend: this.determineTrend(ranking),
      trendAmount: null,
    };

    this.setCached(cacheKey, result, RANKING_CONSTANTS.USER_RANK_CACHE_TTL);
    return result;
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

  private determineTrend(ranking: {
    dailyRank: number | null;
    weeklyRank: number | null;
    monthlyRank: number | null;
    allTimeRank: number | null;
  }): 'up' | 'down' | 'same' | 'new' {
    if (ranking.allTimeRank === null) return 'new';
    return 'same';
  }

  private async getCachedTotalParticipants(period: RankingPeriod): Promise<number> {
    const cacheKey = `total:${period}`;
    const cached = this.getCached<number>(cacheKey);
    if (cached !== undefined) return cached;

    const total = await this.rankingRepository.getTotalParticipants(period);
    this.setCached(cacheKey, total, RANKING_CONSTANTS.TOTAL_USERS_CACHE_TTL);
    return total;
  }

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  private invalidateUserCache(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`pos:${userId}:`) || key.startsWith('lb:')) {
        this.cache.delete(key);
      }
    }
  }
}
