import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users } from '@/core/database/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { UserMeRow, UserRepositoryPort } from '../../domain/ports/user-repository.port';

const USER_ME_COLUMNS = {
  userId: users.userId,
  username: users.username,
  email: users.email,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  bio: users.bio,
  xpTotal: users.xpTotal,
  currentStreak: users.currentStreak,
  longestStreak: users.longestStreak,
  settings: users.settings,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

@Injectable()
export class UserRepository implements UserRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findMeById(userId: string): Promise<UserMeRow | null> {
    const [user] = await this.db
      .select(USER_ME_COLUMNS)
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    return (user as UserMeRow | undefined) ?? null;
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    const [updated] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: nowIso })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .returning(USER_ME_COLUMNS);

    return (updated as UserMeRow | undefined) ?? null;
  }

  async updateSettings(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
  ): Promise<UserMeRow | null> {
    const [updated] = await this.db
      .update(users)
      .set({
        settings: sql`${users.settings} || ${JSON.stringify(settings)}::jsonb`,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .returning(USER_ME_COLUMNS);

    return (updated as UserMeRow | undefined) ?? null;
  }
}
