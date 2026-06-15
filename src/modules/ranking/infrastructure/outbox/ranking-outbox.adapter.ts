/**
 * Ranking Outbox Adapter
 *
 * Implements RankingOutboxPort by inserting into the shared outbox_events table.
 * The event is inserted inside the caller's transaction to guarantee atomicity.
 *
 * Producer-side idempotency: the outbox_events table has a partial
 * unique index `uq_outbox_events_idempotency_unprocessed` on
 * idempotency_key WHERE processed_at IS NULL. Ranking events always
 * pass an explicit idempotency key (e.g. `xp:userId:attempt:attemptId`
 * for XP events). The insert is `ON CONFLICT DO NOTHING` so a
 * duplicated event in the same transaction (e.g. due to an upstream
 * retry that re-entered the XP-ingestion path) does not raise a
 * unique violation; it is silently dropped at the producer boundary.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { RankingOutboxPort } from '../../domain/ports/ranking-outbox.port';

@Injectable()
export class RankingOutboxAdapter implements RankingOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleRankingEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx: unknown,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    // Ranking events always carry an explicit idempotency key
    // (derived in XpIngestionService). If a caller forgets to pass
    // one we still insert with a NULL key, which is allowed by the
    // partial unique index (NULL != NULL), so the producer-side
    // dedup is a no-op for that event and the processor-side dedup
    // is the only safety net.
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'ranking',
        eventType: params.eventType,
        payload: params.payload,
        createdAt: params.nowIso,
        idempotencyKey: params.idempotencyKey,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
      });
  }
}
