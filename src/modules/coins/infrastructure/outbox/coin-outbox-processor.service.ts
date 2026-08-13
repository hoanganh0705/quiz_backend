/**
 * Coin Outbox Processor Service
 *
 * Cron-polled job that reads unprocessed coin events from
 * `outbox_events` and dispatches them onto the in-process
 * `CoinDomainEventBus`. The same retry / DLQ strategy as
 * `RankingOutboxProcessorService`:
 *
 *   delay = base_delay_seconds × 2^(attemptCount - 1)
 *   base = 30s → 30s → 60s → 2m → 4m → 8m → 16m → 32m → 64m
 *
 * After 8 attempts the event is moved to DLQ (`failed_at + dlq_reason`
 * set). Uniqueness conflicts on the outbox partial index are treated as
 * already-processed and the row is marked done (the same defensive
 * parser heuristic that `RankingOutboxProcessorService` uses).
 *
 * ## Event types
 *
 * Today only one event type is scheduled: `coin.added` — emitted by
 * `CoinIngestionService` after a wallet write commits. After the row is
 * fetched, the processor emits *two* in-process events for each
 * committed row:
 *
 *   - `coin.balance_changed` — carries the post-update balance.
 *   - `coin.transaction_recorded` — carries the full ledger row.
 *
 * (Both share the `CoinDomainEventBus` — split at the event-type
 * discriminator for future fan-out like social-feed activity.)
 *
 * The realtime gateway (Phase 5) subscribes to `coin.balance_changed`
 * and pushes `coin:balance_changed` over WebSocket; the activity
 * projector (also Phase 5) subscribes to `coin.transaction_recorded`.
 */

import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { CoinDomainEventBus } from '../../domain/events/coin-domain.event-bus';
import type { CoinReason } from '../../domain/types/coin.types';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const COIN_OUTBOX_MAX_RETRIES = 8;
const COIN_OUTBOX_BASE_DELAY_SECONDS = 30;

type OutboxEventRow = {
  eventId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  idempotencyKey: string | null;
  correlationId: string | null;
};

type CoinAddedPayload = {
  eventType: 'coin.added';
  userId: string;
  reason: string;
  amount: number;
  newBalance: number;
  transactionId: string;
  balanceAfter: number;
  referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  ledgerCreatedAt: string;
  occurredAt: string;
};

type CoinSpentPayload = {
  eventType: 'coin.spent';
  userId: string;
  reason: string;
  amount: number;
  newBalance: number;
  transactionId: string;
  balanceAfter: number;
  referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  referenceId: string | null;
  category: 'tip' | 'flair' | 'suppress' | 'admin';
  metadata: Record<string, unknown>;
  ledgerCreatedAt: string;
  occurredAt: string;
};

@Injectable()
export class CoinOutboxProcessorService implements OnModuleInit {
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: CoinDomainEventBus,
    @InjectPinoLogger(CoinOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({ event: 'coin_outbox_processor_started' });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'coin'),
          isNull(outboxEvents.processedAt),
          isNull(outboxEvents.failedAt),
          lte(outboxEvents.nextAttemptAt, nowIso),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(this.BATCH_SIZE);

    if (events.length === 0) return;

    let processedCount = 0;

    for (const event of events as OutboxEventRow[]) {
      try {
        this.dispatch(event);
        await this.markProcessed(event.eventId);
        processedCount++;
      } catch (error) {
        if (this.isIdempotencyConflict(error)) {
          await this.markProcessed(event.eventId);
          processedCount++;
          this.logger.debug({
            event: 'coin_outbox_event_skipped_idempotent',
            outboxEventId: event.eventId,
            eventType: event.eventType,
          });
          continue;
        }

        await this.handleFailure(event, error);
      }
    }

    if (processedCount > 0) {
      this.logger.info({
        event: 'coin_outbox_processor_completed',
        processedCount,
        scannedCount: events.length,
      });
    }
  }

  private dispatch(event: OutboxEventRow): void {
    if (!this.isSupportedEventType(event.eventType)) {
      // Unknown event type — throw so the DLQ machinery catches it
      // on retry exhaustion (mirrors `AchievementOutboxProcessorService`'s
      // behaviour — see its `isSupportedEventType` guard). A "log and
      // skip" alternative would silently drop the row, hiding a
      // payload-shape or wire-contract regression; the DLQ row +
      // `error` log are the loud signal the on-call path needs.
      throw new Error(`Unsupported coin outbox event type: ${event.eventType}`);
    }

    const correlationId = event.correlationId ?? createCorrelationId();

    void correlationIdStorage.run({ correlationId }, () => {
      if (event.eventType === 'coin.added') {
        this.dispatchCoinAdded(event.payload as unknown as CoinAddedPayload);
        return;
      }
      if (event.eventType === 'coin.spent') {
        this.dispatchCoinSpent(event.payload as unknown as CoinSpentPayload);
        return;
      }
    });
  }

  private isSupportedEventType(eventType: string): boolean {
    return eventType === 'coin.added' || eventType === 'coin.spent';
  }

  private dispatchCoinAdded(payload: CoinAddedPayload): void {
    const occurredAt = new Date(payload.occurredAt ?? payload.ledgerCreatedAt);
    const balanceAfter = Number(payload.balanceAfter ?? payload.newBalance);
    const amount = Number(payload.amount);
    const referenceType = payload.referenceType ?? null;
    const reason = payload.reason as CoinReason;

    // 1. `CoinBalanceChangedEvent` — slim payload for the realtime
    //    gateway (Phase 5) and any other "what changed?" subscriber.
    this.eventBus.emitBalanceChanged({
      eventType: 'coin.balance_changed',
      userId: payload.userId,
      delta: amount,
      reason,
      newBalance: balanceAfter,
      referenceType,
      referenceId: payload.referenceId,
      timestamp: occurredAt,
    });

    // 2. `CoinTransactionRecordedEvent` — the full ledger row for the
    //    activity feed / history page. The transactionId and
    //    reference pair are the durable handle the consumer can
    //    dedup against.
    this.eventBus.emitTransactionRecorded({
      eventType: 'coin.transaction_recorded',
      transactionId: payload.transactionId,
      userId: payload.userId,
      reason,
      amount,
      balanceAfter,
      referenceType,
      referenceId: payload.referenceId,
      timestamp: occurredAt,
    });
  }

  /**
   * Mirror of `dispatchCoinAdded` for the spend side (Phase 6).
   * Spends emit `coin.spent` with a negative `amount`; the
   * `CoinBalanceChangedEvent.delta` is signed so consumers can
   * branch on `delta < 0` (e.g. the toast hides itself).
   */
  private dispatchCoinSpent(payload: CoinSpentPayload): void {
    const occurredAt = new Date(payload.occurredAt ?? payload.ledgerCreatedAt);
    const balanceAfter = Number(payload.balanceAfter ?? payload.newBalance);
    const amount = Number(payload.amount);
    const referenceType = payload.referenceType ?? null;
    const reason = payload.reason as CoinReason;

    this.eventBus.emitBalanceChanged({
      eventType: 'coin.balance_changed',
      userId: payload.userId,
      delta: amount,
      reason,
      newBalance: balanceAfter,
      referenceType,
      referenceId: payload.referenceId,
      timestamp: occurredAt,
    });

    this.eventBus.emitTransactionRecorded({
      eventType: 'coin.transaction_recorded',
      transactionId: payload.transactionId,
      userId: payload.userId,
      reason,
      amount,
      balanceAfter,
      referenceType,
      referenceId: payload.referenceId,
      timestamp: occurredAt,
    });
  }

  private async handleFailure(event: OutboxEventRow, error: unknown): Promise<void> {
    const nextAttemptCount = event.attemptCount + 1;
    const nowIso = new Date().toISOString();
    const nextAttemptAt = computeNextAttemptIso(nextAttemptCount, nowIso);
    const lastError = error instanceof Error ? error.message : String(error);

    const isDlq = nextAttemptCount > COIN_OUTBOX_MAX_RETRIES;

    const updateValues: Record<string, unknown> = {
      attemptCount: nextAttemptCount,
      lastAttemptAt: nowIso,
      nextAttemptAt,
      lastError,
    };

    if (isDlq) {
      updateValues.failedAt = nowIso;
      updateValues.dlqReason = `exhausted_retries:${lastError}`;

      this.logger.error({
        event: 'coin_outbox_event_dlq',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        maxRetries: COIN_OUTBOX_MAX_RETRIES,
        message: lastError,
      });
    } else {
      this.logger.warn({
        event: 'coin_outbox_event_retry_scheduled',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        nextAttemptAt,
        message: lastError,
      });
    }

    await this.db
      .update(outboxEvents)
      .set(updateValues)
      .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));
  }

  private async markProcessed(eventId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db
      .update(outboxEvents)
      .set({
        processedAt: nowIso,
        lastAttemptAt: nowIso,
      })
      .where(eq(outboxEvents.eventId, eventId));
  }

  private isIdempotencyConflict(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('duplicate') ||
        msg.includes('unique') ||
        msg.includes('23505') ||
        msg.includes('idempotency')
      );
    }
    return false;
  }
}

function computeNextAttemptIso(attemptCount: number, nowIso: string): string {
  const exponent = Math.max(0, attemptCount - 1);
  const delaySeconds = COIN_OUTBOX_BASE_DELAY_SECONDS * 2 ** exponent;
  const next = new Date(nowIso);
  next.setUTCSeconds(next.getUTCSeconds() + delaySeconds);
  return next.toISOString();
}
