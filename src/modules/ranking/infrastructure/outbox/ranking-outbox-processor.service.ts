/**
 * Ranking Outbox Processor Service
 *
 * Background job that reads unprocessed ranking domain events from the outbox
 * table and replays them to in-memory subscribers via RankingDomainEventBus.
 *
 * Retry strategy:
 *   delay = base_delay_seconds × 2^(attemptCount - 1)
 *   With base=30s: 30s → 60s → 2m → 4m → 8m → 16m → 32m → 64m
 *
 * After 8 attempts the event is moved to DLQ (failed_at + dlq_reason set).
 * Events with idempotency keys that hit a uniqueness conflict are assumed already
 * processed and are silently marked as done.
 *
 * Correlation ID propagation:
 *   - Outbox rows may carry a correlationId in their metadata
 *   - Before dispatching, set the ID in AsyncLocalStorage so downstream
 *     handlers (achievement evaluation, notifications, social feed) can
 *     read it via getCorrelationId() instead of generating a new one
 */

import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { RankingDomainEvent } from '../../domain/events/ranking-domain.events';
import { RankingDomainEventBus } from '../../domain/events/ranking-domain.event-bus';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const RANKING_OUTBOX_MAX_RETRIES = 8;
const RANKING_OUTBOX_BASE_DELAY_SECONDS = 30;

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

@Injectable()
export class RankingOutboxProcessorService implements OnModuleInit {
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: RankingDomainEventBus,
    @InjectPinoLogger(RankingOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({ event: 'ranking_outbox_processor_started' });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'ranking'),
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
        await this.dispatch(event);
        await this.markProcessed(event.eventId);
        processedCount++;
      } catch (error) {
        if (this.isIdempotencyConflict(error)) {
          // Unique constraint hit: another instance processed it. Mark done and continue.
          await this.markProcessed(event.eventId);
          processedCount++;
          this.logger.debug({
            event: 'ranking_outbox_event_skipped_idempotent',
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
        event: 'ranking_outbox_processor_completed',
        processedCount,
        scannedCount: events.length,
      });
    }
  }

  private async dispatch(event: OutboxEventRow): Promise<void> {
    const domainEvent = event.payload as unknown as RankingDomainEvent;
    const correlationId = event.correlationId ?? createCorrelationId();

    correlationIdStorage.run({ correlationId }, () => {
      this.eventBus.dispatchToSubscribers(domainEvent);
    });
  }

  private async handleFailure(event: OutboxEventRow, error: unknown): Promise<void> {
    const nextAttemptCount = event.attemptCount + 1;
    const nowIso = new Date().toISOString();
    const nextAttemptAt = computeNextAttemptIso(nextAttemptCount, nowIso);
    const lastError = error instanceof Error ? error.message : String(error);

    const isDlq = nextAttemptCount > RANKING_OUTBOX_MAX_RETRIES;

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
        event: 'ranking_outbox_event_dlq',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        maxRetries: RANKING_OUTBOX_MAX_RETRIES,
        message: lastError,
      });
    } else {
      this.logger.warn({
        event: 'ranking_outbox_event_retry_scheduled',
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
  const delaySeconds = RANKING_OUTBOX_BASE_DELAY_SECONDS * 2 ** exponent;
  const next = new Date(nowIso);
  next.setUTCSeconds(next.getUTCSeconds() + delaySeconds);
  return next.toISOString();
}
