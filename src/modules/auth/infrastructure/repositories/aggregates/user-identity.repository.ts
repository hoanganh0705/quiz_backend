import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, max, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userProfiles, userRanking, userSessions } from '@/core/database/schema';
import type { UserMeRow } from '@/modules/user/domain/ports/user-repository.port';
import {
  type UserIdentityRow,
  type UserWithPasswordRow,
  USER_IDENTITY_COLUMNS,
} from './user.types';

@Injectable()
export class UserIdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
      .limit(1);

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
    role: 'admin' | 'moderator' | 'user';
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
      .limit(1);

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
      .limit(1);

    return (user as { userId: string; email: string; passwordHash: string } | undefined) ?? null;
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
      .limit(1);

    return (foundUser as UserWithPasswordRow | undefined) ?? null;
  }

  async findActiveIdentityById(userId: string): Promise<UserIdentityRow | null> {
    const [user] = await this.db
      .select(USER_IDENTITY_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    return (user as UserIdentityRow | undefined) ?? null;
  }

  async findMeById(userId: string): Promise<UserMeRow | null> {
    const [user] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
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
      .limit(1);

    return (user as UserMeRow | undefined) ?? null;
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const result = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.email, email)))
      .limit(1);

    return (result?.length ?? 0) === 0;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const result = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.username, username)))
      .limit(1);

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
      .limit(1);

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
}
