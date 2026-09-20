import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userSessions } from '@/core/database/schema';
import { OUTBOX_PORT } from '@/modules/auth/domain/ports/outbox.port';
import type { OutboxPort } from '@/modules/auth/domain/ports/outbox.port';
import { DeletionFailedError } from '@/modules/auth/domain/errors';

@Injectable()
export class AccountLifecycleRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
  ) {}

  /**
   * Atomically soft-deletes a user and revokes all their active sessions.
   *
   * Serializes this deletion against any concurrent reset-password or change-password
   * operation for the same user via pg_advisory_xact_lock. Without this lock,
   * a reset-password flow could update the password hash of a deleted user after
   * the soft-delete commits, creating a "zombie" account that responds to auth
   * but is invisible in normal queries.
   *
   * @throws {DeletionFailedError} user not found or already deleted
   */
  async deleteAccountAndRevokeSessions(params: {
    userId: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }): Promise<void> {
    const { userId, nowIso, eventPayload } = params;

    const [user] = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to validate user before deletion');
      });

    if (!user) {
      throw new DeletionFailedError('User not found or already deleted');
    }

    await this.db.transaction(async (tx) => {
      // Acquire per-user advisory lock before any destructive writes.
      // Concurrent reset-password / change-password calls for the same user will block here.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

      await tx
        .update(users)
        .set({ deletedAt: nowIso, updatedAt: nowIso })
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)));

      await tx
        .update(userSessions)
        .set({ revokedAt: nowIso })
        .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

      if (eventPayload) {
        await this.outbox.scheduleEvent(
          { aggregateType: 'account', eventType: 'account_deleted', payload: eventPayload, nowIso },
          tx,
        );
      }
    });
  }
}
