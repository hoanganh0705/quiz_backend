import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userProfiles, userRanking } from '@/core/database/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  UserMeRow,
  UserPublicRow,
  UserLookupRow,
  ModeratorRole,
  StreakCacheUpdateResult,
} from '../../../domain/ports/user-repository.port';
import type { UserStreakRawRow } from './user.types';

@Injectable()
export class UserAccountRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  get database(): DrizzleDB {
    return this.db;
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
        avatarPublicId: userProfiles.avatarPublicId,
        bio: userProfiles.bio,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(userRanking, eq(users.userId, userRanking.userId))
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    return (user as UserMeRow | undefined) ?? null;
  }

  async findByUsernames(usernames: string[]): Promise<UserPublicRow[]> {
    if (usernames.length === 0) return [];

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        avatarPublicId: userProfiles.avatarPublicId,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(inArray(users.username, usernames), isNull(users.deletedAt)));

    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      avatarPublicId: r.avatarPublicId ?? null,
    }));
  }

  async findByUsername(username: string): Promise<UserLookupRow | null> {
    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        avatarPublicId: userProfiles.avatarPublicId,
        isVerified: users.isVerified,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(eq(users.username, username), isNull(users.deletedAt)))
      .limit(1);

    const r = rows[0];
    if (!r) return null;

    return {
      userId: r.userId,
      username: r.username,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      avatarPublicId: r.avatarPublicId ?? null,
      isVerified: r.isVerified,
    };
  }

  async findUsersByRole(roles: ModeratorRole[]): Promise<{ userId: string }[]> {
    if (roles.length === 0) return [];

    const rows = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(inArray(users.role, roles), isNull(users.deletedAt)));

    return rows.map((r) => ({ userId: r.userId }));
  }

  async updateStreakCache(
    userId: string,
    finishedAt: Date,
    tx: DrizzleDB,
  ): Promise<StreakCacheUpdateResult | null> {
    const client = tx ?? this.db;
    const dayIso = finishedAt.toISOString();

    const result = (await client.execute(sql`
      UPDATE users u
      SET
        current_streak  = src.new_current,
        longest_streak  = src.new_longest,
        last_streak_day = GREATEST(u.last_streak_day, ${dayIso}::date)
      FROM (
        SELECT
          u.user_id,
          u.current_streak,
          u.longest_streak,
          u.last_streak_day,
          CASE
            WHEN ${dayIso}::date < u.last_streak_day                            THEN u.current_streak
            WHEN ${dayIso}::date = u.last_streak_day                            THEN u.current_streak
            WHEN ${dayIso}::date = u.last_streak_day + INTERVAL '1 day'         THEN u.current_streak + 1
            ELSE 1
          END AS new_current,
          GREATEST(
            u.longest_streak,
            CASE
              WHEN ${dayIso}::date < u.last_streak_day                            THEN u.current_streak
              WHEN ${dayIso}::date = u.last_streak_day                            THEN u.current_streak
              WHEN ${dayIso}::date = u.last_streak_day + INTERVAL '1 day'         THEN u.current_streak + 1
              ELSE 1
            END
          ) AS new_longest
        FROM users u
        WHERE u.user_id = ${userId}::uuid AND u.deleted_at IS NULL
      ) src
      WHERE u.user_id = src.user_id
        AND (u.current_streak  IS DISTINCT FROM src.new_current
          OR u.longest_streak  IS DISTINCT FROM src.new_longest
          OR u.last_streak_day IS DISTINCT FROM GREATEST(u.last_streak_day, ${dayIso}::date))
      RETURNING u.current_streak, u.longest_streak, u.last_streak_day
    `)) as { rows: UserStreakRawRow[] };

    const row = result.rows[0];
    if (!row) return null;

    return {
      currentStreak: Number(row.current_streak),
      longestStreak: Number(row.longest_streak),
      lastStreakDay: row.last_streak_day,
    };
  }
}
