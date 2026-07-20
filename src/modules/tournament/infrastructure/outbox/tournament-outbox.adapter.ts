/**
 * Tournament Outbox Adapter
 *
 * Implements TournamentOutboxPort by inserting into the shared outbox_events table.
 * The event is inserted inside the caller's transaction to guarantee atomicity.
 *
 * Producer-side idempotency: the outbox_events table has a partial unique index
 * `uq_outbox_events_idempotency_unprocessed` on idempotency_key WHERE processed_at IS NULL.
 * Tournament events always pass an explicit idempotency key. The insert uses
 * `ON CONFLICT DO NOTHING` so a duplicated event in the same transaction does not
 * raise a unique violation; it is silently dropped at the producer boundary.
 */

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type {
  TournamentOutboxPort,
  TournamentOutboxPayload,
} from '../../domain/ports/tournament-outbox.port';

@Injectable()
export class TournamentOutboxAdapter implements TournamentOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleTournamentEvent(
    params: {
      eventType: string;
      payload: TournamentOutboxPayload;
      idempotencyKey: string;
      correlationId?: string;
    },
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    // Tournament events always carry an explicit idempotency key derived from
    // the event data (e.g. `tournament:joined:{tournamentId}:{userId}`).
    // The partial unique index only applies when the key is NOT NULL, so
    // duplicate inserts within the same transaction are silently dropped.
    //
    // The `where` clause on the conflict target must match the partial-index
    // predicate `WHERE processed_at IS NULL AND idempotency_key IS NOT NULL`
    // verbatim — otherwise Postgres cannot infer the index and planning fails.
    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'tournament',
        eventType: params.eventType,
        payload: params.payload as Record<string, unknown>,
        createdAt: nowIso,
        idempotencyKey: params.idempotencyKey,
        correlationId: params.correlationId,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
