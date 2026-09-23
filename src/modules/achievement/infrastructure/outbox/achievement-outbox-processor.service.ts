import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { BaseOutboxProcessor, type BaseOutboxRow } from '@/common/outbox/base-outbox-processor';
import { AchievementDomainEventBus } from '../../domain/events/achievement-domain.event-bus';
import type { AchievementDomainEvent } from '../../domain/events/achievement.events';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const ACHIEVEMENT_OUTBOX_MAX_RETRIES = 8;
const ACHIEVEMENT_OUTBOX_BASE_DELAY_SECONDS = 30;
const ACHIEVEMENT_OUTBOX_BATCH_SIZE = 100;

type AchievementOutboxRow = BaseOutboxRow & {
  eventType: string;
};

@Injectable()
export class AchievementOutboxProcessorService extends BaseOutboxProcessor<AchievementOutboxRow> {
  protected readonly batchSize = ACHIEVEMENT_OUTBOX_BATCH_SIZE;
  protected readonly maxRetries = ACHIEVEMENT_OUTBOX_MAX_RETRIES;
  protected readonly baseDelaySeconds = ACHIEVEMENT_OUTBOX_BASE_DELAY_SECONDS;
  protected readonly aggregateType = 'Achievement';
  protected readonly logPrefix = 'achievement';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: AchievementDomainEventBus,
    @InjectPinoLogger(AchievementOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    const result = await this.runProcessPendingEvents(this.db);
    if (result.processed > 0) {
      this.logger.info({
        event: 'achievement_outbox_processor_completed',
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
        event: 'achievement_outbox_dlq_alert',
        totalDlqEvents: count,
      });
    }
  }

  protected dispatch(row: AchievementOutboxRow): Promise<void> {
    const supported = ['achievement.awarded', 'badge.revoked', 'badge.restored'];
    if (!supported.includes(row.eventType)) {
      return Promise.reject(
        new Error(`Unsupported achievement outbox event type: ${String(row.eventType)}`),
      );
    }

    const domainEvent = row.payload as unknown as AchievementDomainEvent;
    const correlationId = row.correlationId ?? createCorrelationId();

    let captured: unknown;
    correlationIdStorage.run({ correlationId }, () => {
      try {
        this.eventBus.emit(domainEvent);
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

  protected override onIdempotencyConflict(row: AchievementOutboxRow): void {
    this.logger.debug({
      event: 'achievement_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      eventType: row.eventType,
    });
  }
}
