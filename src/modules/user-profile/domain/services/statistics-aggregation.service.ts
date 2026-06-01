/**
 * Statistics Aggregation Service
 *
 * Composes statistics from multiple domains and manages caching.
 * Implements the layered caching strategy from the design document.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AchievementQueryPort } from '../ports/achievement-query.port';
import type { AttemptQueryPort } from '../ports/attempt-query.port';
import type { RankingQueryPort } from '../ports/ranking-query.port';
import type { TournamentQueryPort } from '../ports/tournament-query.port';
import type { StatisticsView, RankingView, ActivityView } from '../types/profile.types';
import { RANKING_QUERY_PORT } from '../ports/ranking-query.port';
import { ACHIEVEMENT_QUERY_PORT } from '../ports/achievement-query.port';
import { ATTEMPT_QUERY_PORT } from '../ports/attempt-query.port';
import { TOURNAMENT_QUERY_PORT } from '../ports/tournament-query.port';
import { ProfileCacheService } from './profile-cache.service';

export interface StatisticsAggregationResult {
  statistics: StatisticsView;
  ranking: RankingView;
}

@Injectable()
export class StatisticsAggregationService {
  constructor(
    @Inject(RANKING_QUERY_PORT)
    private readonly rankingQuery: RankingQueryPort,
    @Inject(ACHIEVEMENT_QUERY_PORT)
    private readonly achievementQuery: AchievementQueryPort,
    @Inject(ATTEMPT_QUERY_PORT)
    private readonly attemptQuery: AttemptQueryPort,
    @Inject(TOURNAMENT_QUERY_PORT)
    private readonly tournamentQuery: TournamentQueryPort,
    private readonly cacheService: ProfileCacheService,
    @InjectPinoLogger(StatisticsAggregationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get statistics view for a user.
   * Uses cache with fallback to source domains.
   */
  async getStatistics(userId: string): Promise<StatisticsView> {
    const cached = await this.cacheService.getStatistics(userId);
    if (cached !== undefined) {
      this.logger.debug({
        event: 'statistics_cache_hit',
        userId,
      });
      return cached;
    }

    this.logger.debug({
      event: 'statistics_cache_miss',
      userId,
    });

    const statistics = await this.computeStatistics(userId);
    await this.cacheService.setStatistics(userId, statistics);

    return statistics;
  }

  /**
   * Get ranking view for a user.
   * Uses cache with fallback to source domains.
   */
  async getRanking(userId: string): Promise<RankingView> {
    const cached = await this.cacheService.getRanking(userId);
    if (cached !== undefined) {
      this.logger.debug({
        event: 'ranking_cache_hit',
        userId,
      });
      return cached;
    }

    this.logger.debug({
      event: 'ranking_cache_miss',
      userId,
    });

    const ranking = await this.computeRanking(userId);
    await this.cacheService.setRanking(userId, ranking);

    return ranking;
  }

  /**
   * Get activity view for a user.
   * Uses cache with fallback to source domains.
   */
  async getActivity(userId: string): Promise<ActivityView> {
    const cached = await this.cacheService.getActivity(userId);
    if (cached !== undefined) {
      this.logger.debug({
        event: 'activity_cache_hit',
        userId,
      });
      return cached;
    }

    this.logger.debug({
      event: 'activity_cache_miss',
      userId,
    });

    const activity = this.computeActivity();
    await this.cacheService.setActivity(userId, activity);

    return activity;
  }

  /**
   * Compute statistics from source domains.
   */
  private async computeStatistics(userId: string): Promise<StatisticsView> {
    const [totalXp, attemptStats, tournamentStats, longestStreak] = await Promise.all([
      this.rankingQuery.getTotalXp(userId),
      this.attemptQuery.getUserStatistics(userId),
      this.tournamentQuery.getUserTournamentStats(userId),
      this.achievementQuery.getLongestStreak(userId),
    ]);

    const totalQuizzesCompleted = await this.attemptQuery.getTotalCompletedQuizzes(userId);

    return {
      totalXp,
      totalQuizzesCompleted,
      totalAttempts: attemptStats.totalAttempts,
      averageScore: attemptStats.averageScore,
      accuracyRate: attemptStats.accuracyRate,
      totalTournamentsJoined: tournamentStats.totalTournamentsJoined,
      totalTournamentsWon: tournamentStats.totalTournamentsWon,
      longestStreak,
    };
  }

  /**
   * Compute ranking view from source domains.
   */
  private async computeRanking(userId: string): Promise<RankingView> {
    const [globalRank, weeklyRank, monthlyRank] = await Promise.all([
      this.rankingQuery.getRankInfo(userId, 'all_time'),
      this.rankingQuery.getRankInfo(userId, 'weekly'),
      this.rankingQuery.getRankInfo(userId, 'monthly'),
    ]);

    const peakRanks = await this.getPeakRanks(userId);

    return {
      globalRank,
      weeklyRank,
      monthlyRank,
      peakAllTimeRank: peakRanks.allTime,
      peakWeeklyRank: peakRanks.weekly,
      peakMonthlyRank: peakRanks.monthly,
    };
  }

  /**
   * Get peak ranks from ranking query.
   */
  private async getPeakRanks(userId: string): Promise<{
    allTime: number | null;
    weekly: number | null;
    monthly: number | null;
  }> {
    try {
      const view = await this.rankingQuery.getUserRankingView(userId);
      return {
        allTime: view.peakAllTimeRank,
        weekly: view.peakWeeklyRank,
        monthly: view.peakMonthlyRank,
      };
    } catch {
      return {
        allTime: null,
        weekly: null,
        monthly: null,
      };
    }
  }

  /**
   * Compute activity view.
   * This is a placeholder - actual implementation would query the activity repository.
   */
  private computeActivity(): ActivityView {
    return {
      recentAttempts: [],
      recentTournaments: [],
      timeline: [],
    };
  }

  /**
   * Compute derived metrics from statistics.
   */
  computeDerivedMetrics(
    statistics: StatisticsView,
    ranking: RankingView,
  ): {
    percentile: number;
    xpToNextRank: number | null;
    rankTrend: 'up' | 'down' | 'stable' | 'new';
  } {
    const globalRank = ranking.globalRank;

    if (!globalRank) {
      return {
        percentile: 0,
        xpToNextRank: null,
        rankTrend: 'new',
      };
    }

    const percentile =
      globalRank.totalParticipants > 0
        ? (globalRank.rank! / globalRank.totalParticipants) * 100
        : 0;

    return {
      percentile,
      xpToNextRank: globalRank.xpToNextRank,
      rankTrend: 'stable',
    };
  }
}
