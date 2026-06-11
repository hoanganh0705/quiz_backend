/**
 * Ranking Outbox Adapter
 *
 * Implements RankingOutboxPort by inserting into the shared outbox_events table.
 * The event is inserted inside the caller's transaction to guarantee atomicity.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type {
  RankingOutboxPort,
} from '../../domain/ports/ranking-outbox.port';

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

    await dbOrTx.insert(outboxEvents).values({
      aggregateType: 'ranking',
      eventType: params.eventType,
      payload: params.payload,
      createdAt: params.nowIso,
      idempotencyKey: params.idempotencyKey,
    });
  }
}
