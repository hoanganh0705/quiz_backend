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
   * Idempotency: Duplicate submissions are safely skipped via the idempotency key
   * (unique constraint on the outbox table). Events are written atomically: the XP
   * update and the outbox row are committed in the same DB transaction.
   * If the process crashes before the outbox processor runs, the event is recovered
   * on next startup.
   *
   * The idempotency key is derived from `attemptId`, `tournamentId`, or a fallback
   * of `{userId}:{source}:{timestamp}`. Callers that need stronger guarantees
   * should pass an explicit `idempotencyKey` field on the event.
   */
  async processXpEvent(event: ExternalXpEarnedEvent): Promise<void> {
    if (!event.userId || !event.amount || event.amount <= 0) {
      throw new InvalidXpEventError(event, 'Invalid event structure');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const idempotencyKey = deriveIdempotencyKey(event, nowIso);

    this.logger.info({
      event: 'xp_event_received',
      userId: event.userId,
      amount: event.amount,
      source: event.source,
      idempotencyKey,
    });

    // Atomic: XP update + outbox row in the same transaction
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

/**
 * Derives a deterministic idempotency key from the XP event.
 * Keys are based on natural event identity to prevent double-processing on retries.
 *
 * Priority:
 * 1. `event.idempotencyKey` — caller-provided key (preferred)
 * 2. `attemptId` — unique per quiz attempt
 * 3. `tournamentId` — unique per tournament participation
 * 4. `{userId}:{source}:{timestamp}` — generic fallback
 */
function deriveIdempotencyKey(event: ExternalXpEarnedEvent, _nowIso: string): string {
  const raw = event as unknown as Record<string, unknown>;

  if (typeof raw.idempotencyKey === 'string') {
    return raw.idempotencyKey;
  }

  if (event.source === 'quiz_attempt' && event.attemptId) {
    return `xp:${event.userId}:attempt:${event.attemptId}`;
  }

  if (event.source === 'tournament' && event.tournamentId) {
    return `xp:${event.userId}:tournament:${event.tournamentId}`;
  }

  if (event.source === 'achievement') {
    const achievementId = raw.achievementId as string | undefined;
    if (achievementId) {
      return `xp:${event.userId}:achievement:${achievementId}`;
    }
  }

  return `xp:${event.userId}:${event.source}:${event.timestamp.toISOString()}`;
}
