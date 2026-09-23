import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';

export interface DailyChallengeXpOutboxPayload {
  readonly userId: string;
  readonly challengeId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly timestamp: string;
}

export const DAILY_CHALLENGE_OUTBOX_PORT = Symbol('DAILY_CHALLENGE_OUTBOX_PORT');

export interface DailyChallengeOutboxPort {
  scheduleXpOutbox(
    payload: DailyChallengeXpOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;
}

@Injectable()
export class DailyChallengeOutboxAdapter implements DailyChallengeOutboxPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async scheduleXpOutbox(
    payload: DailyChallengeXpOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void> {
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'daily_challenge',
        eventType: 'daily_challenge.xp_to_publish',
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
