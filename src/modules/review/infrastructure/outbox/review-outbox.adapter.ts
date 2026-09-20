import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import {
  type ReviewDeletedOutboxPayload,
  type ReviewHelpfulChangedOutboxPayload,
  type ReviewOutboxPort,
  type ReviewSubmittedOutboxPayload,
} from '../../domain/ports/review-outbox.port';

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

  async scheduleReviewHelpfulChanged(
    payload: ReviewHelpfulChangedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'review',
        eventType: 'review.helpful_changed',
        payload: payload as unknown as Record<string, unknown>,
        createdAt: nowIso,
        idempotencyKey: `review:helpful_changed:${payload.quizId}:${payload.reviewId}:${payload.delta}`,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
