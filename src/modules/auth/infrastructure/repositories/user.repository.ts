import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { and, eq, isNull, or, sql, max, gt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userProfiles, userSessions, passwordResetTokens } from '@/core/database/schema';
import type { UserRepositoryPort } from '@/modules/auth/domain/ports/user-repository.port';
import type { UserMeRow } from '@/modules/user/domain/ports/user-repository.port';
import { ResourceConflictError } from '@/modules/auth/domain/errors';

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
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async ensureEmailAndUsernameAvailable(email: string, username: string): Promise<void> {
    const [existingUser] = await this.db
      .select({
        userId: users.userId,
      })
      .from(users)
      .where(and(isNull(users.deletedAt), or(eq(users.email, email), eq(users.username, username))))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    if (existingUser) {
      throw new ResourceConflictError('Username or email already exists');
    }
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

  async findActiveByEmail(email: string): Promise<UserIdentityRow | null> {
    const [user] = await this.db
      .select(USER_IDENTITY_COLUMNS)
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (user as UserIdentityRow | undefined) ?? null;
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
        xpTotal: users.xpTotal,
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
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user');
      });

    return (user as UserMeRow | undefined) ?? null;
  }

  async getSecurityMetadata(userId: string): Promise<{
    emailVerified: boolean;
    lastPasswordChangedAt: string | null;
    lastLoginAt: string | null;
  } | null> {
    const [user] = await this.db
      .select({
        isVerified: users.isVerified,
        passwordChangedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1)
      .catch(() => {
        throw new InternalServerErrorException('Failed to fetch user security data');
      });

    if (!user) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const lastSession = (await this.db
      .select({ lastUsedAt: max(userSessions.lastUsedAt) })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          isNull(userSessions.revokedAt),
          sql`${userSessions.expiresAt} > ${nowIso}`,
        ),
      )
      .catch(() => null)) as { lastUsedAt: string | null } | null;

    return {
      emailVerified: user.isVerified,
      lastPasswordChangedAt: user.passwordChangedAt,
      lastLoginAt: lastSession?.lastUsedAt ?? null,
    };
  }

  async updatePasswordHash(userId: string, passwordHash: string, nowIso: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        passwordHash,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .catch(() => {
        throw new InternalServerErrorException('Failed to update password');
      });
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void> {
    await this.revokeAllActivePasswordResetTokensForUser(userId, new Date().toISOString());

    await this.db
      .insert(passwordResetTokens)
      .values({
        userId,
        tokenHash,
        expiresAt,
        isActive: true,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create password reset token');
      });
  }

  async findActivePasswordResetTokenByHash(
    tokenHash: string,
    nowIso: string,
  ): Promise<{ userId: string; email: string } | null> {
    const [record] = await this.db
      .select({
        userId: passwordResetTokens.userId,
        email: users.email,
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

    return (record as { userId: string; email: string } | undefined) ?? null;
  }

  async markPasswordResetTokenUsed(tokenHash: string, nowIso: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({
        usedAt: nowIso,
        isActive: false,
      })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.isActive, true),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .catch(() => {
        throw new InternalServerErrorException('Failed to mark password reset token as used');
      });
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
}
