import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql, max, gt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  users,
  userProfiles,
  userSessions,
  userRanking,
  passwordResetTokens,
  passwordHistory,
} from '@/core/database/schema';
import type { UserRepositoryPort } from '@/modules/auth/domain/ports/user-repository.port';
import type { UserMeRow } from '@/modules/user/domain/ports/user-repository.port';
import { OUTBOX_PORT } from '@/modules/auth/domain/ports/outbox.port';
import type { OutboxPort } from '@/modules/auth/domain/ports/outbox.port';
import {
  InvalidTokenError,
  DeletionFailedError,
  UserNotFoundError,
} from '@/modules/auth/domain/errors';
import { AuthIdentity } from '../../types/auth-context.types';

/**
 * Timing-safety invariant for login-related queries.
 *
 * Methods that look up a user by an attacker-controlled identifier
 * (`findActiveByEmailWithPassword` and similar) intentionally return
 * `null` for the "no such user" case WITHOUT performing a bcrypt
 * compare. Callers — primarily `AuthLoginService` — are responsible
 * for always running a `passwordProvider.verify(suppliedPassword,
 * passwordProvider.getDummyHash())` before propagating the "not
 * found" / "wrong password" branch as an error. This keeps the
 * response time of the not-found branch indistinguishable from the
 * response time of a real `verify(suppliedPassword, realHash)`
 * attempt, preventing account enumeration via timing side channels.
 *
 * Do NOT "optimise" this contract by:
 *  - returning `null` directly from callers (skips the dummy compare
 *    and leaks existence through timing);
 *  - having the repository itself run the bcrypt compare against a
 *    dummy hash (moves security policy into the persistence layer,
 *    where it cannot be audited alongside the auth domain services).
 *
 * If a new caller (e.g. a future password-reset-confirm endpoint)
 * adds a lookup by email/userId, it MUST follow the same
 * dummy-compare-on-miss pattern. See `auth-login.service.ts:login`
 * for the reference implementation.
 *
 * @see docs/audits/AUTH_MODULE_PRODUCTION_READINESS_AUDIT.md §Phase 8 #19
 */

const USER_IDENTITY_COLUMNS = {
  userId: users.userId,
  username: users.username,
  email: users.email,
  role: users.role,
};

type UserIdentityRow = {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
};

type UserWithPasswordRow = UserIdentityRow & {
  passwordHash: string;
  isVerified: boolean;
};

type CreatedUserRow = UserIdentityRow & {
  createdAt: string;
  isVerified: boolean;
};

type UserVerificationRow = {
  userId: string;
  email: string;
};

type UserVerificationStatusRow = {
  userId: string;
  email: string;
  isVerified: boolean;
};

@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
  ) {}

  async findActiveIdentityByEmail(email: string): Promise<{
    userId: string;
    username: string;
    email: string;
    isVerified: boolean;
    role: 'admin' | 'moderator' | 'user';
  } | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        isVerified: users.isVerified,
        role: users.role,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email.toLowerCase())))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user identity by email');
      });

    return (
      (user as
        | {
            userId: string;
            username: string;
            email: string;
            isVerified: boolean;
            role: 'admin' | 'moderator' | 'user';
          }
        | undefined) ?? null
    );
  }

  async findActiveUserProfile(userId: string): Promise<{
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
    isVerified: boolean;
  } | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        role: users.role,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user profile');
      });

    return (
      (user as
        | {
            userId: string;
            username: string;
            email: string;
            role: 'admin' | 'moderator' | 'user';
            isVerified: boolean;
          }
        | undefined) ?? null
    );
  }

  async findActiveUserCredentialsById(userId: string): Promise<{
    userId: string;
    email: string;
    passwordHash: string;
  } | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user credentials');
      });

    return (user as { userId: string; email: string; passwordHash: string } | undefined) ?? null;
  }

  async createUser(email: string, username: string, passwordHash: string): Promise<CreatedUserRow> {
    const [createdUser] = await this.db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
      })
      .returning({
        ...USER_IDENTITY_COLUMNS,
        createdAt: users.createdAt,
        isVerified: users.isVerified,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    return createdUser as CreatedUserRow;
  }

  async findActiveByEmailWithPassword(email: string): Promise<UserWithPasswordRow | null> {
    const [foundUser] = await this.db
      .select({
        ...USER_IDENTITY_COLUMNS,
        passwordHash: users.passwordHash,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    // Type assertion is needed here because Drizzle's type inference doesn't narrow the type based on the query conditions, it says that foundUser can be  UserWithPasswordRow or undefined
    // if the left side of the nullish coalescing operator is undefined, it will return null, which matches our return type of UserWithPasswordRow | null
    return (foundUser as UserWithPasswordRow | undefined) ?? null;
  }

  async findActiveIdentityById(userId: string): Promise<UserIdentityRow | null> {
    const [user] = await this.db
      .select(USER_IDENTITY_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (user as UserIdentityRow | undefined) ?? null;
  }

  async setEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAtIso: string,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAtIso,
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to save email verification token');
      });
  }

  async findActiveVerificationStatusByEmail(
    email: string,
  ): Promise<UserVerificationStatusRow | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        email: users.email,
        isVerified: users.isVerified,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user verification status');
      });

    return (user as UserVerificationStatusRow | undefined) ?? null;
  }

  async findUserByActiveVerificationToken(
    tokenHash: string,
    nowIso: string,
  ): Promise<UserVerificationRow | null> {
    // `isVerified = false` ensures token is one-time use: once verification succeeds,
    // user becomes verified and subsequent reuse attempts cannot match this query.
    const [user] = await this.db
      .select({
        userId: users.userId,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.isVerified, false),
          eq(users.emailVerificationTokenHash, tokenHash),
          gt(users.emailVerificationExpiresAt, nowIso),
        ),
      )
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user by verification token');
      });

    return (user as UserVerificationRow | undefined) ?? null;
  }

  async markEmailAsVerified(userId: string, nowIso: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isVerified: true,
        emailVerifiedAt: nowIso,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to mark email as verified');
      });
  }

  async findMeById(userId: string): Promise<UserMeRow | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        // `xp_total` was dropped in migration 0010; LEFT JOIN
        // `user_ranking.all_time_xp` is the authoritative source. See
        // `docs/plans/denormalized-counters-audit.md` — Fix #3.
        xpTotal: sql<number>`COALESCE(${userRanking.allTimeXp}, 0)`,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        settings: users.settings,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        bio: userProfiles.bio,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(userRanking, eq(users.userId, userRanking.userId))
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (user as UserMeRow | undefined) ?? null;
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const result = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1)
      .catch(() => null);

    return (result?.length ?? 0) === 0;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const result = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.username, username)))
      .limit(1)
      .catch(() => null);

    return (result?.length ?? 0) === 0;
  }

  async getSecurityMetadata(userId: string): Promise<{
    emailVerified: boolean;
    lastPasswordChangedAt: string | null;
    lastLoginAt: string | null;
    activeSessionCount: number;
  } | null> {
    const nowIso = new Date().toISOString();

    const [metadata] = await this.db
      .select({
        emailVerified: users.isVerified,
        lastPasswordChangedAt: users.passwordChangedAt,
        lastLoginAt: max(userSessions.lastUsedAt),
        activeSessionCount: sql<number>`count(${userSessions.sessionId})`,
      })
      .from(users)
      .leftJoin(
        userSessions,
        and(
          eq(userSessions.userId, users.userId),
          isNull(userSessions.revokedAt),
          sql`${userSessions.expiresAt} > ${nowIso}`,
        ),
      )
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .groupBy(users.userId, users.isVerified, users.passwordChangedAt)
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user security data');
      });

    if (!metadata) {
      return null;
    }

    return {
      emailVerified: metadata.emailVerified,
      lastPasswordChangedAt: metadata.lastPasswordChangedAt ?? null,
      lastLoginAt: metadata.lastLoginAt ?? null,
      activeSessionCount: Number(metadata.activeSessionCount ?? 0),
    };
  }

  async getRecentPasswordHashes(userId: string, count: number): Promise<string[]> {
    const rows = await this.db
      .select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(count);

    return rows.map((row) => row.passwordHash);
  }

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
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to validate user before password change');
      });

    if (!user) {
      throw new UserNotFoundError('User not found or already deleted');
    }

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

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
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)));

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
