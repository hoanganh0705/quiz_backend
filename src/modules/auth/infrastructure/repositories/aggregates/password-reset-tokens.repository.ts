import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, passwordResetTokens, userSessions } from '@/core/database/schema';
import { OUTBOX_PORT } from '@/modules/auth/domain/ports/outbox.port';
import type { OutboxPort } from '@/modules/auth/domain/ports/outbox.port';
import { InvalidTokenError } from '@/modules/auth/domain/errors';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
  ) {}

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void> {
    // Both revocation of old tokens and insertion of the new token must happen atomically.
    // If the process crashes between the revoke and the insert, all active tokens are
    // invalidated but no new token exists — locking the user out of their account.
    // Wrapping both in a single transaction eliminates this failure window.
    const nowIso = new Date().toISOString();
    await this.db.transaction(async (tx) => {
      await tx
        .update(passwordResetTokens)
        .set({ revokedAt: nowIso, isActive: false })
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            eq(passwordResetTokens.isActive, true),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      await tx.insert(passwordResetTokens).values({
        userId,
        tokenHash,
        expiresAt,
        isActive: true,
      });
    });
  }

  async findActivePasswordResetTokenByHash(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; passwordResetTokenId: string } | null> {
    const [record] = await this.db
      .select({
        userId: passwordResetTokens.userId,
        // Needed so the auth domain can include the row's PK in the
        // outbox event payload. The outbox adapter derives a
        // deterministic idempotency key from
        // `password_reset:completed:<userId>:<passwordResetTokenId>`,
        // and that lookup requires either `resetId` or
        // `passwordResetTokenId` in the payload.
        passwordResetTokenId: passwordResetTokens.passwordResetTokenId,
      })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.userId))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.isActive, true),
          sql`${passwordResetTokens.expiresAt} > ${nowIso}`,
          isNull(passwordResetTokens.usedAt),
          isNull(passwordResetTokens.revokedAt),
          isNull(users.deletedAt),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to find password reset token');
      });

    return (record as { userId: string; passwordResetTokenId: string } | undefined) ?? null;
  }

  async revokeAllActivePasswordResetTokensForUser(userId: string, nowIso: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({
        revokedAt: nowIso,
        isActive: false,
      })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          eq(passwordResetTokens.isActive, true),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .catch(() => {
        throw new InternalServerErrorException('Failed to revoke active password reset tokens');
      });
  }

  /**
   * Atomically consumes a password-reset token, updates the user's password hash,
   * and revokes all active sessions.
   *
   * Race-condition fix: uses pg_advisory_xact_lock(hashtext(userId)) scoped to the
   * user, so concurrent requests for the same user serialize at the advisory lock.
   * The lock is held for the duration of the transaction only. Lightweight compared
   * to SELECT FOR UPDATE — it does not block concurrent reads of the token row.
   * If the token is invalid, the lookup returns null before any lock is acquired.
   *
   * @throws {InvalidTokenError} token not found, expired, already used, or user deleted
   */
  async consumePasswordResetTokenAndResetPassword(params: {
    tokenHash: string;
    passwordHash: string;
    nowIso: string;
    eventPayload?: Record<string, unknown>;
  }): Promise<{ userId: string }> {
    const { tokenHash, passwordHash, nowIso, eventPayload } = params;

    // Step 1: lightweight lookup to get the userId (no lock held).
    // Returns null fast if the token is invalid — avoids acquiring any lock.
    const [tokenLookup] = await this.db
      .select({ userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.userId))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.isActive, true),
          sql`${passwordResetTokens.expiresAt} > ${nowIso}`,
          isNull(passwordResetTokens.usedAt),
          isNull(passwordResetTokens.revokedAt),
          isNull(users.deletedAt),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to validate password reset token');
      });

    if (!tokenLookup) {
      throw new InvalidTokenError('Invalid or expired password reset token');
    }

    const userId = tokenLookup.userId;

    // Step 2: acquire advisory lock scoped to this userId, then do all writes atomically.
    // pg_advisory_xact_lock is transaction-scoped — automatically released on commit/rollback.
    // Concurrent requests for the SAME user serialize here; requests for different users proceed in parallel.
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

      // Re-validate the token inside the lock in case it was consumed by a concurrent request.
      const [tokenRecord] = await tx
        .select({ userId: passwordResetTokens.userId })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            eq(passwordResetTokens.isActive, true),
            sql`${passwordResetTokens.expiresAt} > ${nowIso}`,
            isNull(passwordResetTokens.usedAt),
          ),
        )
        .limit(1);

      if (!tokenRecord) {
        throw new InvalidTokenError('Invalid or expired password reset token');
      }

      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: nowIso, updatedAt: nowIso })
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: nowIso, isActive: false })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            eq(passwordResetTokens.userId, userId),
            eq(passwordResetTokens.isActive, true),
          ),
        );

      await tx
        .update(userSessions)
        .set({ revokedAt: nowIso })
        .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

      if (eventPayload) {
        await this.outbox.scheduleEvent(
          {
            aggregateType: 'password_reset',
            eventType: 'password_reset_completed',
            payload: eventPayload,
            nowIso,
          },
          tx,
        );
      }
    });

    return { userId };
  }
}
