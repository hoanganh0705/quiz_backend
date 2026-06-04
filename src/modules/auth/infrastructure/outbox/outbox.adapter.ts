import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import type { OutboxPort } from '../../domain/ports/outbox.port';

@Injectable()
export class OutboxAdapter implements OutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleEvent(
    params: {
      aggregateType: string;
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
    },
    tx?: unknown,
  ): Promise<void> {
    // When called from within a repository's db.transaction() callback, callers
    // pass the transaction client (type: any/DrizzleTransaction). Using the tx's
    // insert() ensures the outbox row is committed atomically with the domain write.
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await dbOrTx.insert(outboxEvents).values({
      aggregateType: params.aggregateType,
      eventType: params.eventType,
      payload: params.payload,
      createdAt: params.nowIso,
    });
  }
}
