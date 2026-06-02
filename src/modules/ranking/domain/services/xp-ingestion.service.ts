/**
 * XP Ingestion Service
 *
 * Handles XP events from various sources and updates user rankings.
 * Part of Phase 1 - Foundation.
 *
 * Architecture Note: XP ingestion is core ranking logic.
 * Notification delivery is delegated via NotificationPort to Notification domain.
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
import type { ExternalXpEarnedEvent } from '../events/ranking-domain.events';
import { InvalidXpEventError } from '../errors/ranking-domain.errors';
import { RankCalculationService } from './rank-calculation.service';

@Injectable()
export class XpIngestionService {
  constructor(
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    private readonly rankCalculationService: RankCalculationService,
    @InjectPinoLogger(XpIngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Process an XP earned event from another domain.
   * This is the main entry point for XP ingestion.
   */
  async processXpEvent(event: ExternalXpEarnedEvent): Promise<void> {
    // Validate event
    if (!event.userId || !event.amount || event.amount <= 0) {
      throw new InvalidXpEventError(event, 'Invalid event structure');
    }

    const now = new Date();

    this.logger.info({
      event: 'xp_event_received',
      userId: event.userId,
      amount: event.amount,
      source: event.source,
    });

    // Update XP in all periods
    const updatedRanking = await this.rankingRepository.updateXp({
      userId: event.userId,
      amount: event.amount,
      now,
    });

    // Emit XpAdded event for other domains to react
    this.eventBus.emitXpAdded({
      eventType: 'xp.added',
      userId: event.userId,
      amount: event.amount,
      newAllTimeXp: updatedRanking.allTimeXp,
      newWeeklyXp: updatedRanking.weeklyXp,
      newMonthlyXp: updatedRanking.monthlyXp,
      timestamp: now,
    });

    // Queue rank recalculation for all periods
    await this.rankCalculationService.queueRankRecalculation(event.userId, [
      RankingPeriod.ALL_TIME,
      RankingPeriod.WEEKLY,
      RankingPeriod.MONTHLY,
    ]);

    this.logger.info({
      event: 'xp_event_processed',
      userId: event.userId,
      newAllTimeXp: updatedRanking.allTimeXp,
    });
  }

  /**
   * Add XP directly without an event (for testing or manual adjustments).
   */
  async addXp(userId: string, amount: number, now = new Date()): Promise<void> {
    if (amount <= 0) {
      throw new InvalidXpEventError({ userId, amount }, 'Amount must be positive');
    }

    const event: ExternalXpEarnedEvent = {
      eventType: 'external.xp.earned',
      userId,
      amount,
      source: 'bonus', // Default to bonus for direct additions
      timestamp: now,
    };

    await this.processXpEvent(event);
  }

  /**
   * Bulk process multiple XP events.
   * Useful for migrations or batch operations.
   */
  async bulkProcessXpEvents(events: ExternalXpEarnedEvent[]): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const event of events) {
      try {
        await this.processXpEvent(event);
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Failed to process XP event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return results;
  }
}
