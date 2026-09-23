import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { outboxEvents } from '@/core/database/schema';
import type { CoinOutboxPort, CoinTx } from '../../domain/ports/coin-outbox.port';

@Injectable()
export class CoinOutboxAdapter implements CoinOutboxPort {
  async scheduleCoinEvent(
    params: {
      eventType: string;
      payload: Record<string, unknown>;
      nowIso: string;
      idempotencyKey?: string;
    },
    tx: CoinTx,
  ): Promise<void> {
    await tx
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
