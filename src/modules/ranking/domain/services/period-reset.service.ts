/**
 * Period Reset Service
 *
 * Handles weekly and monthly period resets for rankings.
 * Part of Phase 2 - Core Features.
 *
 * Reset Schedule:
 * - Weekly: Every Monday at 00:00:00 UTC
 * - Monthly: 1st of each month at 00:00:00 UTC
 *
 * Reset Process:
 * 1. Archive current period rankings to rank_history
 * 2. Reset XP counters for the period
 * 3. Clear rank values for the period
 * 4. Emit reset events
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../ports/ranking-event-bus.port';
import { RankingPeriod } from '../types/ranking.types';
import type { PeriodResetResult } from '../types/ranking.types';
import { PeriodResetError } from '../errors/ranking-domain.errors';

@Injectable()
export class PeriodResetService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(PeriodResetService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Perform a daily reset.
   * Archives current daily rankings and resets counters.
   */
  async performDailyReset(): Promise<PeriodResetResult> {
    const now = new Date();

    if (now.getUTCHours() !== 0) {
      this.logger.warn({
        event: 'daily_reset_skipped',
        reason: 'Not at midnight UTC',
        hour: now.getUTCHours(),
      });
      return {
        period: RankingPeriod.DAILY,
        usersAffected: 0,
        archivedRecords: 0,
        resetAt: now,
      };
    }

    return this.executeReset(RankingPeriod.DAILY, now);
  }

  /**
   * Perform a weekly reset.
   * Archives current weekly rankings and resets counters.
   */
  async performWeeklyReset(): Promise<PeriodResetResult> {
    const now = new Date();

    // Verify it's time for a weekly reset (Monday)
    if (now.getUTCDay() !== 1) {
      this.logger.warn({
        event: 'weekly_reset_skipped',
        reason: 'Not Monday',
        currentDay: now.getUTCDay(),
      });
      return {
        period: RankingPeriod.WEEKLY,
        usersAffected: 0,
        archivedRecords: 0,
        resetAt: now,
      };
    }

    // Also check if it's within the first hour of the day to prevent multiple resets
    if (now.getUTCHours() !== 0) {
      this.logger.warn({
        event: 'weekly_reset_skipped',
        reason: 'Not at midnight UTC',
        hour: now.getUTCHours(),
      });
      return {
        period: RankingPeriod.WEEKLY,
        usersAffected: 0,
        archivedRecords: 0,
        resetAt: now,
      };
    }

    return this.executeReset(RankingPeriod.WEEKLY, now);
  }

  /**
   * Perform a monthly reset.
   * Archives current monthly rankings and resets counters.
   */
  async performMonthlyReset(): Promise<PeriodResetResult> {
    const now = new Date();

    // Verify it's time for a monthly reset (1st of month)
    if (now.getUTCDate() !== 1) {
      this.logger.warn({
        event: 'monthly_reset_skipped',
        reason: 'Not first day of month',
        currentDate: now.getUTCDate(),
      });
      return {
        period: RankingPeriod.MONTHLY,
        usersAffected: 0,
        archivedRecords: 0,
        resetAt: now,
      };
    }

    // Also check if it's within the first hour of the day
    if (now.getUTCHours() !== 0) {
      this.logger.warn({
        event: 'monthly_reset_skipped',
        reason: 'Not at midnight UTC',
        hour: now.getUTCHours(),
      });
      return {
        period: RankingPeriod.MONTHLY,
        usersAffected: 0,
        archivedRecords: 0,
        resetAt: now,
      };
    }

    return this.executeReset(RankingPeriod.MONTHLY, now);
  }

  /**
   * Execute the reset process for a specific period.
   * Can be called directly for testing or manual resets.
   */
  async executeReset(period: RankingPeriod, resetAt: Date): Promise<PeriodResetResult> {
    this.logger.info({
      event: 'period_reset_initiated',
      period,
      resetAt: resetAt.toISOString(),
    });

    try {
      // Emit reset initiated event
      this.eventBus.emitPeriodResetInitiated({
        eventType: 'period.reset.initiated',
        period,
        resetAt,
        usersAffected: 0, // Will be updated
        timestamp: resetAt,
      });

      // Perform the reset
      const usersAffected = await this.rankingRepository.resetPeriod(period, resetAt);

      // Emit reset completed event
      this.eventBus.emitPeriodResetCompleted({
        eventType: 'period.reset.completed',
        period,
        previousPeriodEnd: resetAt,
        archivedRecords: usersAffected,
        newPeriodStart: resetAt,
        timestamp: resetAt,
      });

      this.logger.info({
        event: 'period_reset_completed',
        period,
        usersAffected,
      });

      return {
        period,
        usersAffected,
        archivedRecords: usersAffected,
        resetAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new PeriodResetError(period, message);
    }
  }

  /**
   * Force a reset without time validation.
   * Use with caution - typically for migrations or corrections.
   */
  async forceReset(period: RankingPeriod, resetAt: Date = new Date()): Promise<PeriodResetResult> {
    this.logger.warn({
      event: 'forced_reset',
      period,
      resetAt: resetAt.toISOString(),
    });

    return this.executeReset(period, resetAt);
  }

  /**
   * Check if a reset is due.
   * Useful for scheduling and validation.
   */
  isResetDue(period: RankingPeriod, now: Date = new Date()): boolean {
    switch (period) {
      case RankingPeriod.DAILY:
        return now.getUTCHours() === 0 && now.getUTCMinutes() < 5;

      case RankingPeriod.WEEKLY:
        return now.getUTCDay() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 5;

      case RankingPeriod.MONTHLY:
        return now.getUTCDate() === 1 && now.getUTCHours() === 0 && now.getUTCMinutes() < 5;

      case RankingPeriod.ALL_TIME:
        return false;

      default:
        return false;
    }
  }

  /**
   * Get the next reset time for a period.
   */
  getNextResetTime(period: RankingPeriod, now: Date = new Date()): Date {
    switch (period) {
      case RankingPeriod.DAILY: {
        const next = new Date(now);
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(0, 0, 0, 0);
        return next;
      }

      case RankingPeriod.WEEKLY: {
        const next = new Date(now);
        const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
        next.setUTCDate(now.getUTCDate() + daysUntilMonday);
        next.setUTCHours(0, 0, 0, 0);
        return next;
      }

      case RankingPeriod.MONTHLY: {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      }

      case RankingPeriod.ALL_TIME:
        return new Date('2099-12-31T23:59:59Z');

      default:
        return now;
    }
  }
}
