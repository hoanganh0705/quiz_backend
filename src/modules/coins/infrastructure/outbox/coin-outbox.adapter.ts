/**
 * Coin Outbox Adapter
 *
 * Writes a coin-domain event into the shared `outbox_events` table.
 * Same partial-unique-index + `ON CONFLICT DO NOTHING` pattern as the
 * ranking adapter so duplicate in-flight events (concurrent retries
 * with the same idempotency key) drop quietly at the producer
 * boundary instead of raising a 23505 to the caller.
 */

import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { CoinOutboxPort } from '../../domain/ports/coin-outbox.port';

@Injectable()
export class CoinOutboxAdapter implements CoinOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleCoinEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx: unknown,
  ): Promise<void> {
    const client = (tx != null ? tx : this.db) as DrizzleDB;

    await client
      .insert(outboxEvents)
      .values({
        aggregateType: 'coin',
        eventType: params.eventType,
        payload: params.payload,
        createdAt: params.nowIso,
        idempotencyKey: params.idempotencyKey,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
