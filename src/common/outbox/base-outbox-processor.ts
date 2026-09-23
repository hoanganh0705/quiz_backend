import { and, asc, eq, isNotNull, isNull, lte, type SQL } from 'drizzle-orm';
import { outboxEvents } from '@/core/database/schema';
import type { DrizzleDB } from '@/core/database/database.module';

/**
 * Shape of the row every outbox processor operates on. The base
 * processor reads exactly these columns so the per-aggregate
 * subclasses only have to provide a `dispatch` callback.
 */
export type BaseOutboxRow = {
  eventId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  idempotencyKey: string | null;
  correlationId: string | null;
};

/**
 * Hooks a concrete outbox processor must implement. The base
 * supplies the row selection, idempotency-conflict detection,
 * retry scheduling, and DLQ movement; subclasses only have to
 * translate the row into a domain side-effect.
 */
export abstract class BaseOutboxProcessor<T extends BaseOutboxRow = BaseOutboxRow> {
  /** Cron-driven batch size. */
  protected abstract readonly batchSize: number;

  /** Maximum attempts before moving the row to DLQ. */
  protected abstract readonly maxRetries: number;

  /** Base delay in seconds for exponential backoff. */
  protected abstract readonly baseDelaySeconds: number;

  /**
   * The aggregate this processor drains. Used by the base to
   * scope the row selection and the DLQ monitor query so a single
   * outbox table can be partitioned across many processors
   * without cross-talk.
   */
  protected abstract readonly aggregateType: string;

  /** Logger event-name prefix (e.g. `coin`, `attempt_xp`). */
  protected abstract readonly logPrefix: string;

  /**
   * Translate the row into a domain side-effect. Throw on
   * permanent failure (will be retried) or return normally on
   * success. Throwing an `OutboxIdempotencyConflictError` (or a
   * subclass) signals the row should be marked processed without
   * retrying — the partial unique index on `idempotency_key` is
   * what triggers it.
   */
  protected abstract dispatch(row: T): Promise<void> | void;

  /**
   * Construct the Drizzle WHERE fragment used to fetch the next
   * batch. Default selects every pending, non-DLQ row whose
   * `nextAttemptAt` is at or before the current tick. Subclasses
   * can override to add an `eventType` filter (e.g. attempt-xp
   * processors scope to `attempt.xp_to_publish` only).
   */
  protected buildPendingWhere(nowIso: string): SQL {
    const extra = this.buildAggregateFilter();
    const clauses: (SQL | undefined)[] = [
      eq(outboxEvents.aggregateType, this.aggregateType),
      isNull(outboxEvents.processedAt),
      isNull(outboxEvents.failedAt),
      lte(outboxEvents.nextAttemptAt, nowIso),
    ];
    if (extra) clauses.push(extra);
    return and(...clauses)!;
  }

  /**
   * Aggregate-specific extra filters (e.g. pin a single
   * `eventType` or add a `correlationId` scope). Default is a
   * `TRUE` literal so subclasses only override when they need to
   * narrow the batch.
   */
  protected buildAggregateFilter(): SQL | undefined {
    return undefined;
  }

  /**
   * Construct the Drizzle WHERE fragment for the DLQ monitor.
   * Selects rows that have been moved to DLQ but not yet marked
   * processed.
   */
  protected buildDlqWhere(): SQL {
    return and(
      eq(outboxEvents.aggregateType, this.aggregateType),
      isNull(outboxEvents.processedAt),
      isNotNull(outboxEvents.failedAt),
      isNotNull(outboxEvents.dlqReason),
    )!;
  }

  /**
   * Select pending rows with `FOR UPDATE SKIP LOCKED` and apply
   * exponential backoff / DLQ discipline. Returns counters so
   * subclasses can log completion metrics.
   */
  async runProcessPendingEvents(db: DrizzleDB): Promise<{
    processed: number;
    failed: number;
    retried: number;
    movedToDlq: number;
    idempotencyConflicts: number;
    scanned: number;
  }> {
    const nowIso = new Date().toISOString();

    const rows = (await db
      .select({
        eventId: outboxEvents.eventId,
        aggregateType: outboxEvents.aggregateType,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
        createdAt: outboxEvents.createdAt,
        attemptCount: outboxEvents.attemptCount,
        idempotencyKey: outboxEvents.idempotencyKey,
        correlationId: outboxEvents.correlationId,
      })
      .from(outboxEvents)
      .where(this.buildPendingWhere(nowIso))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(this.batchSize)
      .for('update', { skipLocked: true })) as T[];

    let processed = 0;
    let failed = 0;
    let retried = 0;
    let movedToDlq = 0;
    let idempotencyConflicts = 0;

    for (const row of rows) {
      try {
        await this.dispatch(row);
        await this.markProcessed(db, row.eventId, nowIso);
        processed += 1;
      } catch (error) {
        if (this.isIdempotencyConflict(error)) {
          await this.markProcessed(db, row.eventId, nowIso);
          processed += 1;
          idempotencyConflicts += 1;
          this.onIdempotencyConflict(row);
          continue;
        }

        const outcome = await this.handleFailure(db, row, error, nowIso);
        failed += 1;
        if (outcome === 'retried') retried += 1;
        if (outcome === 'dlq') movedToDlq += 1;
      }
    }

    return {
      processed,
      failed,
      retried,
      movedToDlq,
      idempotencyConflicts,
      scanned: rows.length,
    };
  }

  /**
   * DLQ monitor. Returns the total count of DLQ'd rows so a
   * subclass can decide whether to emit an alert log.
   */
  async runMonitorDeadLetterQueue(db: DrizzleDB): Promise<number> {
    const rows = await db
      .select({
        eventId: outboxEvents.eventId,
        aggregateType: outboxEvents.aggregateType,
        eventType: outboxEvents.eventType,
        attemptCount: outboxEvents.attemptCount,
        failedAt: outboxEvents.failedAt,
        dlqReason: outboxEvents.dlqReason,
        lastError: outboxEvents.lastError,
      })
      .from(outboxEvents)
      .where(this.buildDlqWhere())
      .limit(1000);

    return rows.length;
  }

  /**
   * Detect a unique-constraint violation against the partial
   * unique index on `outbox_events.idempotency_key`. The matcher
   * is intentionally conservative: PostgreSQL surfaces the
   * violation as a 23505 SQLSTATE, and the human-readable text
   * from the driver includes either `duplicate` or `unique`. We
   * intentionally do NOT match the bare substring `idempotency`
   * because application errors that JSON-stringify a payload
   * containing an `idempotencyKey` field would otherwise look
   * like a conflict.
   *
   * Subclasses that publish to Redis or downstream services may
   * encounter unique violations there. Override to broaden
   * detection to those drivers.
   */
  protected isIdempotencyConflict(error: unknown): boolean {
    if (error instanceof OutboxIdempotencyConflictError) return true;
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('duplicate') ||
        msg.includes('23505') ||
        // Match `unique constraint` or `unique violation` but not
        // bare `unique` substrings inside random payload fields.
        msg.includes('unique constraint') ||
        msg.includes('unique violation')
      );
    }
    return false;
  }

  /**
   * Optional hook for subclasses to log the skipped row at debug
   * level. Default no-op.
   */
  protected onIdempotencyConflict(_row: T): void {}

  private async markProcessed(db: DrizzleDB, eventId: string, nowIso: string): Promise<void> {
    await db
      .update(outboxEvents)
      .set({
        processedAt: nowIso,
        lastAttemptAt: nowIso,
      })
      .where(and(eq(outboxEvents.eventId, eventId), isNull(outboxEvents.processedAt)));
  }

  protected async handleFailure(
    db: DrizzleDB,
    row: T,
    error: unknown,
    nowIso: string,
  ): Promise<'retried' | 'dlq'> {
    const nextAttemptCount = (row.attemptCount ?? 0) + 1;
    const lastError = error instanceof Error ? error.message : String(error);
    const isDlq = nextAttemptCount > this.maxRetries;

    const updateValues: Record<string, unknown> = {
      attemptCount: nextAttemptCount,
      lastAttemptAt: nowIso,
      lastError,
    };

    if (isDlq) {
      updateValues['failedAt'] = nowIso;
      updateValues['dlqReason'] = `exhausted_retries:${lastError}`;
      updateValues['nextAttemptAt'] = nowIso;
    } else {
      updateValues['nextAttemptAt'] = computeNextAttemptIso(
        nextAttemptCount,
        nowIso,
        this.baseDelaySeconds,
      );
    }

    await db
      .update(outboxEvents)
      .set(updateValues)
      .where(and(eq(outboxEvents.eventId, row.eventId), isNull(outboxEvents.processedAt)));

    return isDlq ? 'dlq' : 'retried';
  }
}

/**
 * Throw from `dispatch` to mark the row as already processed
 * without retrying. Use when the side-effect should be skipped
 * because the underlying state already reflects the outcome
 * (e.g. the downstream row already exists from a previous run).
 */
export class OutboxIdempotencyConflictError extends Error {
  constructor(message = 'idempotency_conflict') {
    super(message);
    this.name = 'OutboxIdempotencyConflictError';
  }
}

export function computeNextAttemptIso(
  attemptCount: number,
  nowIso: string,
  baseDelaySeconds: number,
): string {
  const exponent = Math.max(0, attemptCount - 1);
  const delaySeconds = baseDelaySeconds * 2 ** exponent;
  const next = new Date(nowIso);
  next.setUTCSeconds(next.getUTCSeconds() + delaySeconds);
  return next.toISOString();
}
