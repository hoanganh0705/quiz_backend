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
  TournamentOutboxScheduleParams,
} from '../../domain/ports/tournament-outbox.port';

@Injectable()
export class TournamentOutboxAdapter implements TournamentOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleTournamentEvent(
    params: TournamentOutboxScheduleParams,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await this.insertRows(dbOrTx, [params], nowIso);
  }

  async scheduleTournamentEventsBatch(
    events: ReadonlyArray<TournamentOutboxScheduleParams>,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;
    await this.insertRows(dbOrTx, events, nowIso);
  }

  private async insertRows(
    dbOrTx: DrizzleDB,
    events: ReadonlyArray<TournamentOutboxScheduleParams>,
    nowIso: string,
  ): Promise<void> {
    const values = events.map((e) => ({
      aggregateType: 'tournament',
      eventType: e.eventType,
      payload: e.payload as Record<string, unknown>,
      createdAt: nowIso,
      idempotencyKey: e.idempotencyKey,
      correlationId: e.correlationId,
    }));

    await dbOrTx
      .insert(outboxEvents)
      .values(values)
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
