import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userProfiles, users, userRanking } from '@/core/database/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { UserMeRow } from '../../../domain/ports/user-repository.port';

@Injectable()
export class UserProfileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAvatarPublicIdByUserId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ avatarPublicId: userProfiles.avatarPublicId })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return row?.avatarPublicId ?? null;
  }

  async updateProfile(
    userId: string,
    patch: {
      displayName?: string | null;
      bio?: string | null;
      avatarPublicId?: string | null;
      avatarUrl?: string | null;
    },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.db.transaction(async (tx) => {
      const profileSet: {
        displayName?: string | null;
        bio?: string | null;
        avatarPublicId?: string | null;
        avatarUrl?: string | null;
        updatedAt: string;
      } = { updatedAt: nowIso };

      if ('displayName' in patch) profileSet.displayName = patch.displayName;
      if ('bio' in patch) profileSet.bio = patch.bio;
      if ('avatarPublicId' in patch) profileSet.avatarPublicId = patch.avatarPublicId;
      if ('avatarUrl' in patch) profileSet.avatarUrl = patch.avatarUrl;

      const existing = await tx
        .select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        await tx.insert(userProfiles).values({
          userId,
          displayName: patch.displayName ?? null,
          avatarPublicId: patch.avatarPublicId ?? null,
          avatarUrl: patch.avatarUrl ?? null,
          bio: patch.bio ?? null,
          updatedAt: nowIso,
        });
      } else if (Object.keys(profileSet).length > 1) {
        await tx.update(userProfiles).set(profileSet).where(eq(userProfiles.userId, userId));
      }

      await tx.update(users).set({ updatedAt: nowIso }).where(eq(users.userId, userId));

      const [user] = await tx
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
          avatarPublicId: userProfiles.avatarPublicId,
          bio: userProfiles.bio,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .leftJoin(userRanking, eq(users.userId, userRanking.userId))
        .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
        .limit(1);

      return (user as UserMeRow | undefined) ?? null;
    });
  }
}
