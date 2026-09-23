/**
 * XP Ingestion Service
 *
 * Handles XP events from various sources and updates user rankings.
 * Events are persisted to the transactional outbox to guarantee at-least-once delivery.
 * Idempotency is enforced via an idempotency key derived from the event payload,
 * preventing double-processing when the same event is retried.
 *
 * Architecture Note: XP ingestion is core ranking logic.
 * Notification delivery is delegated via NotificationPort to Notification domain.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import {
  RANKING_REPOSITORY_PORT,
  type RankingRepositoryPort,
} from '../ports/ranking-repository.port';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../ports/ranking-event-bus.port';
import { RANKING_OUTBOX_PORT, type RankingOutboxPort } from '../ports/ranking-outbox.port';
import { RankingPeriod } from '../types/ranking.types';
import type { ExternalXpEarnedEvent } from '../events/ranking-domain.events';
import { InvalidXpEventError } from '../errors/ranking-domain.errors';
import { RankCalculationService } from './rank-calculation.service';

@Injectable()
export class XpIngestionService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(RANKING_REPOSITORY_PORT)
    private readonly rankingRepository: RankingRepositoryPort,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(RANKING_OUTBOX_PORT)
    private readonly outbox: RankingOutboxPort,
    private readonly rankCalculationService: RankCalculationService,
    @InjectPinoLogger(XpIngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Process an XP earned event from another domain.
   *
   * `idempotencyKey` is required and trusted verbatim. Duplicate submissions
   * are skipped via the partial unique index on
   * `outbox_events(idempotency_key)` for unprocessed rows.
   */
  async processXpEvent(event: ExternalXpEarnedEvent): Promise<void> {
    if (!event.userId || !event.amount || event.amount <= 0) {
      throw new InvalidXpEventError(event, 'Invalid event structure');
    }
    if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.length === 0) {
      throw new InvalidXpEventError(event, 'idempotencyKey is required');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const idempotencyKey = event.idempotencyKey;

    this.logger.info({
      event: 'xp_event_received',
      userId: event.userId,
      amount: event.amount,
      source: event.source,
      idempotencyKey,
    });

    // Atomic: XP update + outbox row in the same transaction.
    await this.db.transaction(async (tx) => {
      const updatedRanking = await this.rankingRepository.updateXpInTx(tx, {
        userId: event.userId,
        amount: event.amount,
        now,
      });

      // Schedule XpAdded event for durable dispatch via the outbox processor
      await this.outbox.scheduleRankingEvent(
        {
          eventType: 'xp.added',
          payload: {
            eventType: 'xp.added',
            userId: event.userId,
            amount: event.amount,
            newAllTimeXp: updatedRanking.allTimeXp,
            newWeeklyXp: updatedRanking.weeklyXp,
            newMonthlyXp: updatedRanking.monthlyXp,
            newDailyXp: updatedRanking.dailyXp,
            timestamp: nowIso,
          },
          nowIso,
          idempotencyKey,
        },
        tx,
      );

      // Queue rank recalculation for all periods (same transaction)
      await this.rankCalculationService.queueRankRecalculationInTx(tx, event.userId, [
        RankingPeriod.ALL_TIME,
        RankingPeriod.WEEKLY,
        RankingPeriod.MONTHLY,
        RankingPeriod.DAILY,
      ]);
    });

    this.logger.info({
      event: 'xp_event_processed',
      userId: event.userId,
      newAllTimeXp: undefined, // log after tx commit
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
      source: 'bonus',
      idempotencyKey: `xp:${userId}:manual:${now.toISOString()}`,
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
