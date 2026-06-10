import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { idempotencyKeys } from '@/core/database/schema';

export const IDEMPOTENCY_SERVICE = Symbol('IDEMPOTENCY_SERVICE');

export interface IdempotencyResult<T> {
  isNew: boolean;
  response: T | null;
}

const IDEMPOTENCY_TTL_HOURS = 24;

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(IdempotencyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async checkAndSet<T>(
    key: string,
    userId: string,
    operation: string,
    computeResponse: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const [existing] = await this.db
      .select({ response: idempotencyKeys.response })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.userId, userId)))
      .limit(1);

    if (existing) {
      this.logger.debug({ event: 'idempotency_key_hit', key, operation });
      return { isNew: false, response: existing.response as T };
    }

    const response = await computeResponse();

    try {
      await this.db
        .insert(idempotencyKeys)
        .values({
          key,
          userId,
          operation,
          response: response as Record<string, unknown>,
          createdAt: nowIso,
          expiresAt,
        })
        .onConflictDoNothing();

      this.logger.debug({ event: 'idempotency_key_set', key, operation });
      return { isNew: true, response };
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        const [recheck] = await this.db
          .select({ response: idempotencyKeys.response })
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.userId, userId)))
          .limit(1);

        if (recheck) {
          return { isNew: false, response: recheck.response as T };
        }
      }
      throw error;
    }
  }

  async deleteExpired(): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.db
      .delete(idempotencyKeys)
      .where(sql`${idempotencyKeys.expiresAt} < ${nowIso}`);

    return result.rowCount ?? 0;
  }
}
