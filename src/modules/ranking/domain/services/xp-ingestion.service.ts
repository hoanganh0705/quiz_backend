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
import {
  RANKING_DEDUPE_PORT,
  type RankingDedupePort,
  type XpIngestSource,
} from '../ports/ranking-dedupe.port';
import { RankingPeriod } from '../types/ranking.types';
import type { ExternalXpEarnedEvent } from '../events/ranking-domain.events';
import { InvalidXpEventError } from '../errors/ranking-domain.errors';
import { RankCalculationService } from './rank-calculation.service';
import { RankingCacheVersionService } from './ranking-cache-version.service';
import { MetricsRegistry } from '@/core/observability/metrics.registry';
import { TracingProvider } from '@/core/observability/tracing.provider';

const XP_DEDUPE_TTL_SECONDS = 7 * 86_400;

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
    private readonly cacheVersionService: RankingCacheVersionService,
    @Inject(RANKING_DEDUPE_PORT)
    private readonly dedupe: RankingDedupePort,
    private readonly metricsRegistry: MetricsRegistry,
    private readonly tracing: TracingProvider,
    @InjectPinoLogger(XpIngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Process an XP earned event from another domain.
   *
   * `idempotencyKey` is required and trusted verbatim. Duplicate submissions
   * are short-circuited at three layers, in order:
   *
   *   1. Redis SETNX guard (this service). Fail-open on Redis outage.
   *   2. Partial unique index on `outbox_events(idempotency_key)`.
   *   3. App-side state checks inside the DB transaction.
   *
   * The `source` parameter is purely observability — it tags the
   * `xp_ingest_duplicate_skipped_total` counter so we can detect which
   * path (in-proc, outbox, manual) is racing itself.
   */
  async processXpEvent(
    event: ExternalXpEarnedEvent,
    source: XpIngestSource = 'in_proc',
  ): Promise<void> {
    return this.tracing.withSpan(
      'xp.ingest',
      {
        kind: 'internal',
        attributes: {
          'xp.idempotencyKey': event.idempotencyKey ?? '',
          'xp.source': source,
        },
      },
      () => Promise.resolve(this.processXpEventInner(event, source)),
    );
  }

  private async processXpEventInner(
    event: ExternalXpEarnedEvent,
    source: XpIngestSource,
  ): Promise<void> {
    if (!event.userId || !event.amount || event.amount <= 0) {
      throw new InvalidXpEventError(event, 'Invalid event structure');
    }
    if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.length === 0) {
      throw new InvalidXpEventError(event, 'idempotencyKey is required');
    }

    const idempotencyKey = event.idempotencyKey;

    const claimed = await this.dedupe.tryClaimXp(idempotencyKey, XP_DEDUPE_TTL_SECONDS);
    if (!claimed) {
      this.metricsRegistry.incXpIngestDuplicateSkipped(source);
      this.logger.debug({
        event: 'xp_duplicate_skipped',
        idempotencyKey,
        source,
      });
      return;
    }

    try {
      await this.applyXpEvent(event);
    } catch (error) {
      await this.dedupe.releaseXp(idempotencyKey);
      throw error;
    }
  }

  private async applyXpEvent(event: ExternalXpEarnedEvent): Promise<void> {
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

    await this.cacheVersionService.bumpAllPeriods();
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

    await this.processXpEvent(event, 'manual');
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

    const validEvents: ExternalXpEarnedEvent[] = [];
    for (const event of events) {
      if (!event.userId || !event.amount || event.amount <= 0) {
        results.failed++;
        results.errors.push(`Invalid event structure for user ${event.userId}`);
        continue;
      }
      if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.length === 0) {
        results.failed++;
        results.errors.push(`Missing idempotencyKey for user ${event.userId}`);
        continue;
      }
      const claimed = await this.dedupe.tryClaimXp(event.idempotencyKey, XP_DEDUPE_TTL_SECONDS);
      if (!claimed) {
        results.processed++;
        continue;
      }
      validEvents.push(event);
    }

    if (validEvents.length > 0) {
      const now = new Date();
      const nowIso = now.toISOString();
      const uniqueUserIds = [...new Set(validEvents.map((e) => e.userId))];

      await this.db.transaction(async (tx) => {
        await this.rankingRepository.processXpEventsBatch({
          events: validEvents.map((e) => ({ userId: e.userId, amount: e.amount, now })),
        });

        for (const event of validEvents) {
          await this.outbox.scheduleRankingEvent(
            {
              eventType: 'xp.added',
              payload: {
                eventType: 'xp.added',
                userId: event.userId,
                amount: event.amount,
                newAllTimeXp: 0,
                newWeeklyXp: 0,
                newMonthlyXp: 0,
                newDailyXp: 0,
                timestamp: nowIso,
              },
              nowIso,
              idempotencyKey: event.idempotencyKey,
            },
            tx,
          );
        }

        await Promise.all(
          uniqueUserIds.map((userId) =>
            this.rankCalculationService.queueRankRecalculationInTx(tx, userId, [
              RankingPeriod.ALL_TIME,
              RankingPeriod.WEEKLY,
              RankingPeriod.MONTHLY,
              RankingPeriod.DAILY,
            ]),
          ),
        );
      });

      results.processed += validEvents.length;
    }

    return results;
  }
}
