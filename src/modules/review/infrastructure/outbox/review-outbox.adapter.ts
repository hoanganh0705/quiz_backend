import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import {
  type ReviewDeletedOutboxPayload,
  type ReviewOutboxPort,
  type ReviewSubmittedOutboxPayload,
} from '../../domain/ports/review-outbox.port';

/**
 * Producer-side adapter for the Transactional Outbox of review
 * domain events.
 *
 * Phase 1 / Issue #3 — every review submission / deletion MUST
 * publish its event into `outbox_events` inside the same DB
 * transaction that mutates `quiz_reviews`. The downstream outbox
 * worker (`ReviewOutboxProcessorService`) drains the table and
 * calls the analytics handler; if the worker crashes, the row is
 * left visible and the next worker run picks it up.
 *
 * Idempotency
 * -----------
 *
 * Each event gets a deterministic `idempotency_key` derived from
 * the (aggregate, event, payload) tuple:
 *
 *   `review:submitted:{quizId}:{reviewId}` and
 *   `review:deleted:{quizId}:{reviewId}`.
 *
 * The schema has a partial unique index
 * `uq_outbox_events_idempotency_unprocessed` that matches
 * `processed_at IS NULL AND idempotency_key IS NOT NULL`. We use
 * ON CONFLICT DO NOTHING against that index so a retry of the
 * producer (e.g. transaction-level retry from the application
 * layer) cannot insert duplicate rows.
 */
@Injectable()
export class ReviewOutboxAdapter implements ReviewOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleReviewSubmitted(
    payload: ReviewSubmittedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'review',
        eventType: 'review.submitted',
        payload: payload as unknown as Record<string, unknown>,
        createdAt: nowIso,
        idempotencyKey: `review:submitted:${payload.quizId}:${payload.reviewId}`,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }

  async scheduleReviewDeleted(
    payload: ReviewDeletedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'review',
        eventType: 'review.deleted',
        payload: payload as unknown as Record<string, unknown>,
        createdAt: nowIso,
        idempotencyKey: `review:deleted:${payload.quizId}:${payload.reviewId}`,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
