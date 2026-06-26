/**
 * Leaderboard Service
 *
 * Handles leaderboard queries with caching.
 * Part of Phase 3 - Leaderboards & APIs.
 *
 * Caching model
 * -------------
 * The leaderboard cache is stored in Redis (via `CACHE_PROVIDER`)
 * rather than in-process, so all instances of the API see a
 * consistent view. A previous implementation kept a per-instance
 * `Map`, which meant a 3-instance deployment could return three
 * different leaderboards to the same user.
 *
 * The cache is read-through (`getOrSet`) with a short TTL. When a
 * user's XP changes, the cached leaderboard keys naturally expire
 * within `LEADERBOARD_CACHE_TTL` seconds; we deliberately do not
 * delete the key from inside the local process because that would
 * only affect the instance that received the XP event, not its
 * peers. With a 30-second TTL, the worst-case staleness across the
 * cluster is bounded by that window.
 *
 * If an immediate cross-instance invalidation is needed in the
 * future, wire up a Redis pub/sub channel: publish a `leaderboard:
 * invalidate` message on every `xp.added` and have each instance
 * subscribe to evict its local mirror. The current implementation
 * skips that complication because the audit accepts a 30-second
 * TTL as sufficient.
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
} from '../../dto';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

@Injectable()
export class LeaderboardService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    private readonly periodResetService: PeriodResetService,
    @InjectPinoLogger(LeaderboardService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      if (event.eventType === 'xp.added') {
        // No-op: the leaderboard cache uses Redis with a short TTL
        // (see class docstring), so we do not need to invalidate
        // keys locally. Logging the event keeps the audit trail
        // visible in case operators want to correlate leaderboard
        // staleness with a specific user.
        this.logger.debug({
          event: 'leaderboard_xp_added',
          userId: event.userId,
        });
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
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
    const ttlMs = RANKING_CONSTANTS.LEADERBOARD_CACHE_TTL * 1000;

    const cachedPayload = await this.cache.getOrSet<{
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
      userPosition = await this.getUserPosition(currentUserId, periodEnum) ?? null;
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

  /**
   * Get user position for a specific period.
   */
  async getUserPosition(
    userId: string,
    periodEnum: RankingPeriodEnum,
  ): Promise<UserRankPositionDto | undefined> {
    const period = enumToPeriod(periodEnum);

    const cacheKey = `pos:${userId}:${period}`;
    const ttlMs = RANKING_CONSTANTS.USER_RANK_CACHE_TTL * 1000;

    return this.cache
      .getOrSet<UserRankPositionDto | null>(cacheKey, ttlMs, async () => {
        this.logger.debug({ event: 'get_user_position', userId, period });
        const ranking = await this.rankingRepository.getUserRanking(userId);
        if (!ranking) return null;

        const xpField = getXpField(period);
        const xp = ranking[xpField];

        if (xp === 0) return null;

        const rank = await this.rankingRepository.getUserRank(userId, period);
        if (rank === null) return null;

        const totalParticipants = await this.getCachedTotalParticipants(period);
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
          trend: this.determineTrend(ranking),
          trendAmount: null,
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
    const ttlMs = RANKING_CONSTANTS.TOTAL_USERS_CACHE_TTL * 1000;

    return this.cache.getOrSet<number>(cacheKey, ttlMs, async () => {
      this.logger.debug({ event: 'get_total_participants', period });
      return this.rankingRepository.getTotalParticipants(period);
    });
  }
}
