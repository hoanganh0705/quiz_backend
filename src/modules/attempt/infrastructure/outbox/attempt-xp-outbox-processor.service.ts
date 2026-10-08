/**
 * Attempt XP Outbox Processor Service
 *
 * Drains `outbox_events` rows for `aggregate_type = 'attempt'` and
 * `event_type = 'attempt.xp_to_publish'`, republishing each as an
 * `external.xp.earned` event on the shared XP event bus.
 *
 * The row is inserted in the same DB transaction as the attempt completion,
 * so a Redis outage no longer drops XP attribution. The processor retries
 * with exponential backoff and moves failed rows to DLQ after
 * `ATTEMPT_OUTBOX_MAX_RETRIES` attempts.
 *
 * Idempotency: callers supply `idempotencyKey = xp:${userId}:attempt:${attemptId}`
 * which is unique per logical XP grant. The outbox_events partial unique
 * index guards against duplicate inserts.
 */

import { Inject, Injectable } from '@nestjs/common';
import { eq, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { BaseOutboxProcessor, type BaseOutboxRow } from '@/common/outbox/base-outbox-processor';
import {
  EXTERNAL_EVENT_BUS_PRODUCER_PORT,
  type ExternalEventBusProducerPort,
  type ExternalXpEarnedEvent,
} from '@/common/events/common-external-event-bus';
import { parseAttemptXpOutboxPayload } from '@/common/outbox/payload-schema';

const ATTEMPT_OUTBOX_MAX_RETRIES = 8;
const ATTEMPT_OUTBOX_BASE_DELAY_SECONDS = 30;
const ATTEMPT_OUTBOX_BATCH_SIZE = 100;

type AttemptOutboxRow = BaseOutboxRow & {
  eventId: string;
  eventType: string;
};

@Injectable()
export class AttemptXpOutboxProcessorService extends BaseOutboxProcessor<AttemptOutboxRow> {
  protected readonly batchSize = ATTEMPT_OUTBOX_BATCH_SIZE;
  protected readonly maxRetries = ATTEMPT_OUTBOX_MAX_RETRIES;
  protected readonly baseDelaySeconds = ATTEMPT_OUTBOX_BASE_DELAY_SECONDS;
  protected readonly aggregateType = 'attempt';
  protected readonly logPrefix = 'attempt_xp';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
    @InjectPinoLogger(AttemptXpOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  protected override buildAggregateFilter(): SQL | undefined {
    return eq(outboxEvents.eventType, 'attempt.xp_to_publish');
  }

  async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const result = await this.runProcessPendingEvents(this.db);
    if (result.processed > 0 || result.failed > 0) {
      this.logger.info({
        event: 'attempt_xp_outbox_completed',
        processed: result.processed,
        failed: result.failed,
        idempotencyConflicts: result.idempotencyConflicts,
        movedToDlq: result.movedToDlq,
        scannedCount: result.scanned,
      });
    }
    return { processed: result.processed, failed: result.failed };
  }

  protected async dispatch(row: AttemptOutboxRow): Promise<void> {
    const validated = parseAttemptXpOutboxPayload(row.payload);
    const xpEvent: ExternalXpEarnedEvent = {
      eventType: 'external.xp.earned',
      userId: validated.userId,
      amount: validated.amount,
      source: 'quiz_attempt',
      attemptId: validated.attemptId,
      idempotencyKey: validated.idempotencyKey,
      timestamp: new Date(validated.timestamp),
      correlationId: row.correlationId ?? validated.correlationId,
    };

    await this.externalEventBus.publishXpEarned(xpEvent);

    this.logger.debug({
      event: 'attempt_xp_outbox_dispatched',
      userId: xpEvent.userId,
      attemptId: xpEvent.attemptId,
      amount: xpEvent.amount,
      idempotencyKey: xpEvent.idempotencyKey,
    });
  }

  protected override onIdempotencyConflict(row: AttemptOutboxRow): void {
    this.logger.debug({
      event: 'attempt_xp_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      eventType: row.eventType,
    });
  }
}
