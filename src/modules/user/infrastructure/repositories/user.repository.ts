import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userProfiles } from '@/core/database/schema';
import { and, eq, isNull, or, ilike } from 'drizzle-orm';
import type { UserMeRow, UserSearchResult, UserRepositoryPort } from '../../domain/ports/user-repository.port';

@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
      .limit(1);

    return (user as UserMeRow | undefined) ?? null;
  }

  async searchUsers(query: string, limit: number, excludeUserId?: string): Promise<UserSearchResult[]> {
    // Sanitize query for LIKE pattern
    const searchPattern = `%${query}%`;

    // Build base conditions
    const baseConditions = [
      isNull(users.deletedAt),
      or(
        ilike(users.username, searchPattern),
        ilike(userProfiles.displayName, searchPattern),
      ),
    ];

    // Add exclusion if provided
    const allConditions = excludeUserId
      ? [...baseConditions, eq(users.userId, excludeUserId)]
      : baseConditions;

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...allConditions))
      .limit(limit);

    return rows as UserSearchResult[];
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    await this.db
      .insert(userProfiles)
      .values({
        userId,
        displayName: patch.displayName ?? null,
        avatarUrl: patch.avatarUrl ?? null,
        bio: patch.bio ?? null,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          displayName: patch.displayName ?? null,
          avatarUrl: patch.avatarUrl ?? null,
          bio: patch.bio ?? null,
          updatedAt: nowIso,
        },
      });

    return this.findMeById(userId);
  }

  async updateSettings(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
  ): Promise<UserMeRow | null> {
    const [updated] = await this.db
      .update(users)
      .set({
        settings,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .returning({
        userId: users.userId,
        username: users.username,
        email: users.email,
        xpTotal: users.xpTotal,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        settings: users.settings,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) return null;

    const profile = await this.findMeById(userId);
    return profile;
  }
}
