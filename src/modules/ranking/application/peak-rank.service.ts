/**
 * Peak Rank Service
 *
 * Tracks and updates peak (best) ranks achieved by users.
 * Part of Phase 2 - Core Features.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RankingRepositoryPort } from '../domain/ports/ranking-repository.port';
import type { RankingDomainEventBusPort } from '../domain/ports/ranking-event-bus.port';
import { RankingPeriod } from '../domain/types/ranking.types';
import { RANKING_CONSTANTS } from '../domain/types/ranking.types';

@Injectable()
export class PeakRankService {
  constructor(
    @Inject('RANKING_REPOSITORY')
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject('RANKING_DOMAIN_EVENT_BUS')
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(PeakRankService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Check and update peak rank if the new rank is better.
   *
   * @param userId - The user ID
   * @param period - The ranking period
   * @param newRank - The new rank to check
   * @returns true if a new peak was achieved
   */
  async checkAndUpdatePeakRank(
    userId: string,
    period: RankingPeriod,
    newRank: number,
  ): Promise<boolean> {
    // Get current peak
    const currentRanking = await this.rankingRepository.getUserRanking(userId);
    if (!currentRanking) return false;

    const peakRankField = this.getPeakRankField(period);
    const currentPeak = currentRanking[peakRankField];

    // Update peak if:
    // 1. No peak exists yet (null)
    // 2. New rank is better (lower number)
    if (currentPeak === null || newRank < currentPeak) {
      const updated = await this.rankingRepository.updatePeakRank({
        userId,
        period,
        rank: newRank,
      });

      if (updated) {
        this.logger.info({
          event: 'peak_rank_achieved',
          userId,
          period,
          previousPeak: currentPeak,
          newPeak: newRank,
        });

        // Emit peak rank event
        this.eventBus.emitPeakRankAchieved({
          eventType: 'peak.rank.achieved',
          userId,
          period,
          previousPeakRank: currentPeak,
          newPeakRank: newRank,
          timestamp: new Date(),
        });

        // Check for milestone events
        await this.checkMilestones(userId, period, newRank);

        return true;
      }
    }

    return false;
  }

  /**
   * Check for ranking milestones and emit events.
   */
  private async checkMilestones(
    userId: string,
    period: RankingPeriod,
    rank: number,
  ): Promise<void> {
    const totalParticipants = await this.rankingRepository.getTotalParticipants(period);
    const percentile = totalParticipants > 0
      ? Math.round(((totalParticipants - rank) / totalParticipants) * 10000) / 100
      : 0;

    // Check top 10
    if (rank <= RANKING_CONSTANTS.TOP_10_THRESHOLD) {
      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId,
        period,
        milestoneType: 'top10',
        rank,
        percentile,
        timestamp: new Date(),
      });
    }
    // Check top 100
    else if (rank <= RANKING_CONSTANTS.TOP_100_THRESHOLD) {
      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId,
        period,
        milestoneType: 'top100',
        rank,
        percentile,
        timestamp: new Date(),
      });
    }
    // Check top 1000
    else if (rank <= RANKING_CONSTANTS.TOP_1000_THRESHOLD) {
      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId,
        period,
        milestoneType: 'top1000',
        rank,
        percentile,
        timestamp: new Date(),
      });
    }
    // Check rank 1
    if (rank === 1) {
      this.eventBus.emitRankingMilestone({
        eventType: 'ranking.milestone',
        userId,
        period,
        milestoneType: 'rank1',
        rank,
        percentile,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get peak rank information for a user.
   */
  async getPeakRankInfo(userId: string): Promise<{
    weekly: number | null;
    monthly: number | null;
    allTime: number | null;
  }> {
    const ranking = await this.rankingRepository.getUserRanking(userId);

    if (!ranking) {
      return {
        weekly: null,
        monthly: null,
        allTime: null,
      };
    }

    return {
      weekly: ranking.peakWeeklyRank,
      monthly: ranking.peakMonthlyRank,
      allTime: ranking.peakAllTimeRank,
    };
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
