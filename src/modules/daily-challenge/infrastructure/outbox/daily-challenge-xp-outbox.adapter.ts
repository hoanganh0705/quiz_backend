import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import {
  type DailyChallengeXpOutboxPayload as ValidatedDailyChallengeXpOutboxPayload,
  parseDailyChallengeXpOutboxPayload,
} from '@/common/outbox/payload-schema';

export type DailyChallengeXpOutboxPayload = ValidatedDailyChallengeXpOutboxPayload;

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
    const validated = parseDailyChallengeXpOutboxPayload(payload);
    const dbOrTx = tx != null ? (tx as DrizzleDB) : this.db;

    await dbOrTx
      .insert(outboxEvents)
      .values({
        aggregateType: 'daily_challenge',
        eventType: 'daily_challenge.xp_to_publish',
        payload: validated,
        createdAt: nowIso,
        idempotencyKey: validated.idempotencyKey,
        correlationId: validated.correlationId,
      })
      .onConflictDoNothing({
        target: outboxEvents.idempotencyKey,
        where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
      });
  }
}
