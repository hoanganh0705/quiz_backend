import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { BaseOutboxProcessor, type BaseOutboxRow } from '@/common/outbox/base-outbox-processor';
import { CoinDomainEventBus } from '../../domain/events/coin-domain.event-bus';
import type { CoinReason } from '../../domain/types/coin.types';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';

const COIN_OUTBOX_MAX_RETRIES = 8;
const COIN_OUTBOX_BASE_DELAY_SECONDS = 30;
const COIN_OUTBOX_BATCH_SIZE = 100;

type CoinOutboxRow = BaseOutboxRow & {
  eventType: 'coin.added' | 'coin.spent';
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
export class CoinOutboxProcessorService extends BaseOutboxProcessor<CoinOutboxRow> {
  protected readonly batchSize = COIN_OUTBOX_BATCH_SIZE;
  protected readonly maxRetries = COIN_OUTBOX_MAX_RETRIES;
  protected readonly baseDelaySeconds = COIN_OUTBOX_BASE_DELAY_SECONDS;
  protected readonly aggregateType = 'coin';
  protected readonly logPrefix = 'coin';

  private isRunning = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly eventBus: CoinDomainEventBus,
    @InjectPinoLogger(CoinOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEvents(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug({ event: 'coin_outbox_processor_skipped_already_running' });
      return;
    }
    this.isRunning = true;
    try {
      const result = await this.runProcessPendingEvents(this.db);
      if (result.processed > 0) {
        this.logger.info({
          event: 'coin_outbox_processor_completed',
          processedCount: result.processed,
          idempotencyConflicts: result.idempotencyConflicts,
          movedToDlq: result.movedToDlq,
          scannedCount: result.scanned,
        });
      }
      if (result.failed > 0) {
        this.logger.error({
          event: 'coin_outbox_processor_failed',
          failed: result.failed,
          retried: result.retried,
          movedToDlq: result.movedToDlq,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'coin_outbox_processor_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isRunning = false;
    }
  }

  @Cron('*/5 * * * *')
  async monitorDeadLetterQueue(): Promise<void> {
    const count = await this.runMonitorDeadLetterQueue(this.db);
    if (count > 0) {
      this.logger.error({
        event: 'coin_outbox_dlq_alert',
        totalDlqEvents: count,
      });
    }
  }

  protected dispatch(row: CoinOutboxRow): Promise<void> {
    if (row.eventType === 'coin.added') {
      return this.dispatchInStorage(row, () =>
        this.dispatchCoinAdded(row.payload as unknown as CoinAddedPayload),
      );
    }
    if (row.eventType === 'coin.spent') {
      return this.dispatchInStorage(row, () =>
        this.dispatchCoinSpent(row.payload as unknown as CoinSpentPayload),
      );
    }
    return Promise.reject(
      new Error(`Unsupported coin outbox event type: ${String(row.eventType)}`),
    );
  }

  private dispatchInStorage(row: CoinOutboxRow, fn: () => void): Promise<void> {
    const correlationId = row.correlationId ?? createCorrelationId();
    let captured: unknown;
    correlationIdStorage.run({ correlationId }, () => {
      try {
        fn();
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

  private dispatchCoinAdded(payload: CoinAddedPayload): void {
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

  protected override onIdempotencyConflict(row: CoinOutboxRow): void {
    this.logger.debug({
      event: 'coin_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      eventType: row.eventType,
    });
  }

  protected override isIdempotencyConflict(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('duplicate') ||
        msg.includes('23505') ||
        msg.includes('unique constraint') ||
        msg.includes('unique violation')
      );
    }
    return false;
  }

  /** @internal exposed for spec */
  public __dbForTests(): DrizzleDB {
    return this.db;
  }

  /** @internal exposed for spec */
  public __outboxEventsTableForTests(): typeof outboxEvents {
    return outboxEvents;
  }
}
