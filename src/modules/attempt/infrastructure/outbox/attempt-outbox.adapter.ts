/**
 * Attempt Outbox Adapter
 *
 * Inserts attempt-XP outbox rows inside the caller's DB transaction so the
 * XP dispatch to the ranking module is durable and recoverable on Redis
 * outage. Replaces the previous direct Redis publish in
 * `AttemptCommandService.completeAttempt` with an outbox row inserted in
 * the same transaction as the attempt completion, then drained by
 * `AttemptXpOutboxProcessorService` on a 15-second cron.
 *
 * Idempotency: the outbox_events partial unique index on idempotency_key
 * (processed_at IS NULL) guarantees no duplicate XP dispatch.
 */

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';

export interface AttemptXpOutboxPayload {
  readonly userId: string;
  readonly attemptId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly timestamp: string;
}

export const ATTEMPT_OUTBOX_PORT = Symbol('ATTEMPT_OUTBOX_PORT');

export interface AttemptOutboxPort {
  scheduleXpOutbox(payload: AttemptXpOutboxPayload, tx: unknown, nowIso: string): Promise<void>;
}

@Injectable()
export class AttemptOutboxAdapter implements AttemptOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleXpOutbox(
    payload: AttemptXpOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'attempt',
        eventType: 'attempt.xp_to_publish',
        payload: payload as unknown as Record<string, unknown>,
        createdAt: nowIso,
        idempotencyKey: payload.idempotencyKey,
        correlationId: payload.correlationId,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
