import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, passwordHistory, userSessions } from '@/core/database/schema';
import { OUTBOX_PORT } from '@/modules/auth/domain/ports/outbox.port';
import type { OutboxPort } from '@/modules/auth/domain/ports/outbox.port';
import { UserNotFoundError } from '@/modules/auth/domain/errors';
import { notDeleted } from '@/common/database/soft-delete.helper';

@Injectable()
export class PasswordChangeRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
  ) {}

  async getRecentPasswordHashes(userId: string, count: number): Promise<string[]> {
    const rows = await this.db
      .select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(count);

    return rows.map((row) => row.passwordHash);
  }

  /**
   * Atomically updates a user's password hash, archives the previous hash to
   * password history (pruning oldest entries when the cap is exceeded), and
   * revokes all sessions except the current one.
   *
   * Serialization: pg_advisory_xact_lock(hashtext(userId)) is held for the
   * duration of the transaction, blocking any concurrent change-password,
   * reset-password, or account-deletion for the same user.
   *
   * @throws {UserNotFoundError} user not found or already deleted
   */
  async changePasswordAndRevokeOtherSessions(params: {
    userId: string;
    passwordHash: string;
    currentSessionId: string;
    nowIso: string;
    previousPasswordHash: string | null;
    maxHistorySize: number;
    eventPayload?: Record<string, unknown>;
  }): Promise<void> {
    const {
      userId,
      passwordHash,
      currentSessionId,
      nowIso,
      previousPasswordHash,
      maxHistorySize,
      eventPayload,
    } = params;

    const [user] = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to validate user before password change');
      });

    if (!user) {
      throw new UserNotFoundError('User not found or already deleted');
    }

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);

      if (previousPasswordHash !== null) {
        await tx.insert(passwordHistory).values({
          userId,
          passwordHash: previousPasswordHash,
          createdAt: nowIso,
        });

        const allEntries = await tx
          .select({ historyId: passwordHistory.historyId })
          .from(passwordHistory)
          .where(eq(passwordHistory.userId, userId))
          .orderBy(desc(passwordHistory.createdAt));

        if (allEntries.length > maxHistorySize) {
          const idsToDelete = allEntries.slice(maxHistorySize).map((e) => e.historyId);
          await tx.delete(passwordHistory).where(inArray(passwordHistory.historyId, idsToDelete));
        }
      }

      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: nowIso, updatedAt: nowIso })
        .where(and(eq(users.userId, userId), notDeleted(users.deletedAt)));

      await tx
        .update(userSessions)
        .set({ revokedAt: nowIso })
        .where(
          and(
            eq(userSessions.userId, userId),
            isNull(userSessions.revokedAt),
            sql`${userSessions.sessionId} <> ${currentSessionId}`,
          ),
        );

      if (eventPayload) {
        await this.outbox.scheduleEvent(
          {
            aggregateType: 'account',
            eventType: 'password_changed',
            payload: eventPayload,
            nowIso,
          },
          tx,
        );
      }
    });
  }
}
