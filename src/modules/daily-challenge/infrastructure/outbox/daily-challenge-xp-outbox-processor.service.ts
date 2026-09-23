import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

const DAILY_CHALLENGE_OUTBOX_MAX_RETRIES = 8;
const DAILY_CHALLENGE_OUTBOX_BASE_DELAY_SECONDS = 30;
const DAILY_CHALLENGE_OUTBOX_BATCH_SIZE = 100;

type DailyChallengeOutboxRow = BaseOutboxRow & {
  eventId: string;
  eventType: string;
};

@Injectable()
export class DailyChallengeXpOutboxProcessorService extends BaseOutboxProcessor<DailyChallengeOutboxRow> {
  protected readonly batchSize = DAILY_CHALLENGE_OUTBOX_BATCH_SIZE;
  protected readonly maxRetries = DAILY_CHALLENGE_OUTBOX_MAX_RETRIES;
  protected readonly baseDelaySeconds = DAILY_CHALLENGE_OUTBOX_BASE_DELAY_SECONDS;
  protected readonly aggregateType = 'daily_challenge';
  protected readonly logPrefix = 'daily_challenge_xp';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(EXTERNAL_EVENT_BUS_PRODUCER_PORT)
    private readonly externalEventBus: ExternalEventBusProducerPort,
    @InjectPinoLogger(DailyChallengeXpOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  protected override buildAggregateFilter(): SQL | undefined {
    return eq(outboxEvents.eventType, 'daily_challenge.xp_to_publish');
  }

  async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const result = await this.runProcessPendingEvents(this.db);
    if (result.processed > 0 || result.failed > 0) {
      this.logger.info({
        event: 'daily_challenge_xp_outbox_completed',
        processed: result.processed,
        failed: result.failed,
        idempotencyConflicts: result.idempotencyConflicts,
        movedToDlq: result.movedToDlq,
        scannedCount: result.scanned,
      });
    }
    return { processed: result.processed, failed: result.failed };
  }

  @Cron('0 */5 * * * *')
  async monitorDeadLetterQueue(): Promise<void> {
    const count = await this.runMonitorDeadLetterQueue(this.db);
    if (count > 0) {
      this.logger.error({
        event: 'daily_challenge_xp_outbox_dlq_alert',
        count,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  protected async dispatch(row: DailyChallengeOutboxRow): Promise<void> {
    const payload = row.payload;
    const challengeId = readString(payload, 'challengeId');
    const xpEvent: ExternalXpEarnedEvent = {
      eventType: 'external.xp.earned',
      userId: readString(payload, 'userId'),
      amount: readNumber(payload, 'amount'),
      source: 'bonus',
      idempotencyKey: readString(payload, 'idempotencyKey'),
      timestamp: readDate(payload, 'timestamp'),
      correlationId: row.correlationId ?? undefined,
    };

    if (!xpEvent.userId || xpEvent.amount <= 0 || !xpEvent.idempotencyKey) {
      throw new Error(`daily_challenge_xp_outbox_invalid_payload: ${JSON.stringify(payload)}`);
    }

    await this.externalEventBus.publishXpEarned(xpEvent);

    this.logger.debug({
      event: 'daily_challenge_xp_outbox_dispatched',
      userId: xpEvent.userId,
      challengeId,
      amount: xpEvent.amount,
      idempotencyKey: xpEvent.idempotencyKey,
    });
  }

  protected override onIdempotencyConflict(row: DailyChallengeOutboxRow): void {
    this.logger.debug({
      event: 'daily_challenge_xp_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      eventType: row.eventType,
    });
  }
}

function readString(payload: Readonly<Record<string, unknown>>, key: string): string {
  const value = payload[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function readNumber(payload: Readonly<Record<string, unknown>>, key: string): number {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readDate(payload: Readonly<Record<string, unknown>>, key: string): Date {
  const value = payload[key];
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}
