/**
 * Achievement Outbox Adapter
 *
 * Inserts achievement domain events into the shared `outbox_events` table.
 * When called within a repository's transaction, the outbox row is committed
 * atomically with the badge award/revocation.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { AchievementOutboxPort } from '../../domain/ports/achievement-outbox.port';
import { ACHIEVEMENT_OUTBOX_PORT } from '../../domain/ports/achievement-outbox.port';

@Injectable()
export class AchievementOutboxAdapter implements AchievementOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleAchievementEvent(
    params: {
      aggregateType: string;
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
    },
    tx?: unknown,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await dbOrTx.insert(outboxEvents).values({
      aggregateType: params.aggregateType,
      eventType: params.eventType,
      payload: params.payload,
      createdAt: params.nowIso,
    });
  }
}

export { ACHIEVEMENT_OUTBOX_PORT };
