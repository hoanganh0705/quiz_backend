/**
 * Ranking Outbox Processor Service
 *
 * Background job that reads unprocessed ranking domain events from the outbox
 * table and replays them to in-memory subscribers via RankingDomainEventBus.
 *
 * Retry strategy is now centralized in BaseOutboxProcessor:
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
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { BaseOutboxProcessor, type BaseOutboxRow } from '@/common/outbox/base-outbox-processor';
import type { RankingDomainEvent } from '../../domain/events/ranking-domain.events';
import { RankingDomainEventBus } from '../../domain/events/ranking-domain.event-bus';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const RANKING_OUTBOX_MAX_RETRIES = 8;
const RANKING_OUTBOX_BASE_DELAY_SECONDS = 30;
const RANKING_OUTBOX_BATCH_SIZE = 100;

type RankingOutboxRow = BaseOutboxRow;

@Injectable()
export class RankingOutboxProcessorService extends BaseOutboxProcessor<RankingOutboxRow> {
  protected readonly batchSize = RANKING_OUTBOX_BATCH_SIZE;
  protected readonly maxRetries = RANKING_OUTBOX_MAX_RETRIES;
  protected readonly baseDelaySeconds = RANKING_OUTBOX_BASE_DELAY_SECONDS;
  protected readonly aggregateType = 'ranking';
  protected readonly logPrefix = 'ranking';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: RankingDomainEventBus,
    @InjectPinoLogger(RankingOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    const result = await this.runProcessPendingEvents(this.db);
    if (result.processed > 0) {
      this.logger.info({
        event: 'ranking_outbox_processor_completed',
        processedCount: result.processed,
        idempotencyConflicts: result.idempotencyConflicts,
        movedToDlq: result.movedToDlq,
        scannedCount: result.scanned,
      });
    }
  }

  @Cron('*/5 * * * *')
  async monitorDeadLetterQueue(): Promise<void> {
    const count = await this.runMonitorDeadLetterQueue(this.db);
    if (count > 0) {
      this.logger.error({
        event: 'ranking_outbox_dlq_alert',
        totalDlqEvents: count,
      });
    }
  }

  protected dispatch(row: RankingOutboxRow): Promise<void> {
    const domainEvent = row.payload as unknown as RankingDomainEvent;
    const correlationId = row.correlationId ?? createCorrelationId();

    let captured: unknown;
    correlationIdStorage.run({ correlationId }, () => {
      try {
        this.eventBus.dispatchToSubscribers(domainEvent);
      } catch (err) {
        captured = err;
      }
    });
    if (captured !== undefined) {
      const reason = captured instanceof Error ? captured.message : JSON.stringify(captured);
      return Promise.reject(new Error(reason));
    }
    return Promise.resolve();
  }

  protected override onIdempotencyConflict(row: RankingOutboxRow): void {
    this.logger.debug({
      event: 'ranking_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      eventType: row.eventType,
    });
  }
}
