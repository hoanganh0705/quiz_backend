/**
 * Achievement Outbox Processor Service
 *
 * Background job that reads unprocessed Achievement outbox rows
 * (`aggregate_type = 'Achievement'`, `event_type` in
 * `{'achievement.awarded', 'achievement.revoked'}`) and replays them
 * to in-process subscribers via the AchievementDomainEventBus.
 *
 * Why a separate processor for Achievement when the events are already
 * published synchronously via the in-process bus?
 *
 * 1. Atomicity: `awardBadge` and `revokeBadge` insert into `outbox_events`
 *    inside the same transaction as the badge write. If the request crashes
 *    after the DB commit but before the synchronous event reaches every
 *    listener (notification, social feed, etc.), the outbox row is a durable
 *    record that this event was committed but not fully delivered.
 *
 * 2. Cross-process delivery: in a multi-instance deployment, listeners in
 *    process B do not see events emitted in process A. The outbox processor
 *    on each instance polls the shared outbox table and replays events
 *    locally so listeners on every instance observe the same event stream.
 *
 * Retry strategy: mirrors `RankingOutboxProcessorService`:
 *   delay = base_delay_seconds × 2^(attemptCount - 1)
 *   With base=30s: 30s → 60s → 2m → 4m → 8m → 16m → 32m → 64m
 *   After 8 attempts the event is moved to DLQ (failed_at + dlq_reason set).
 *
 * Correlation ID propagation: outbox rows may carry a correlationId in their
 * metadata. Before dispatching, the ID is set in AsyncLocalStorage so
 * downstream handlers (notifications, social feed) can read it via
 * getCorrelationId() instead of generating a new one.
 */

import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { AchievementDomainEventBus } from '../../domain/events/achievement-domain.event-bus';
import type { AchievementDomainEvent } from '../../domain/events/achievement.events';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const ACHIEVEMENT_OUTBOX_MAX_RETRIES = 8;
const ACHIEVEMENT_OUTBOX_BASE_DELAY_SECONDS = 30;

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
export class AchievementOutboxProcessorService implements OnModuleInit {
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: AchievementDomainEventBus,
    @InjectPinoLogger(AchievementOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({ event: 'achievement_outbox_processor_started' });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'Achievement'),
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
          await this.markProcessed(event.eventId);
          processedCount++;
          this.logger.debug({
            event: 'achievement_outbox_event_skipped_idempotent',
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
        event: 'achievement_outbox_processor_completed',
        processedCount,
        scannedCount: events.length,
      });
    }
  }

  private async dispatch(event: OutboxEventRow): Promise<void> {
    if (!this.isSupportedEventType(event.eventType)) {
      // Unknown event type — fail permanently so it doesn't loop forever.
      throw new Error(`Unsupported achievement outbox event type: ${event.eventType}`);
    }

    const domainEvent = event.payload as unknown as AchievementDomainEvent;
    const correlationId = event.correlationId ?? createCorrelationId();

    correlationIdStorage.run({ correlationId }, () => {
      this.eventBus.emit(domainEvent);
    });
  }

  private isSupportedEventType(eventType: string): boolean {
    return eventType === 'achievement.awarded' || eventType === 'achievement.revoked';
  }

  private async handleFailure(event: OutboxEventRow, error: unknown): Promise<void> {
    const nextAttemptCount = event.attemptCount + 1;
    const nowIso = new Date().toISOString();
    const nextAttemptAt = computeNextAttemptIso(nextAttemptCount, nowIso);
    const lastError = error instanceof Error ? error.message : String(error);

    const isDlq = nextAttemptCount > ACHIEVEMENT_OUTBOX_MAX_RETRIES;

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
        event: 'achievement_outbox_event_dlq',
        outboxEventId: event.eventId,
        eventType: event.eventType,
        attemptCount: nextAttemptCount,
        maxRetries: ACHIEVEMENT_OUTBOX_MAX_RETRIES,
        message: lastError,
      });
    } else {
      this.logger.warn({
        event: 'achievement_outbox_event_retry_scheduled',
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
      .where(
        and(
          eq(outboxEvents.eventId, event.eventId),
          isNull(outboxEvents.processedAt),
        ),
      );
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
  const delaySeconds = ACHIEVEMENT_OUTBOX_BASE_DELAY_SECONDS * 2 ** exponent;
  const next = new Date(nowIso);
  next.setUTCSeconds(next.getUTCSeconds() + delaySeconds);
  return next.toISOString();
}
