import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  badges,
  categories,
  quizAttempts,
  quizCategories,
  quizTags,
  quizVersions,
  tags,
  userActivityEvents,
  userBadges,
  userProfiles,
  userRanking,
  users,
} from '@/core/database/schema';
import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { UserAnalytics } from '../../domain/types/user-analytics';
import type {
  UserActivityRow,
  UserBadgeRow,
  UserMeRow,
  UserRankingRow,
  UserSearchResult,
  UserRepositoryPort,
} from '../../domain/ports/user-repository.port';

export const USER_BADGE_COLUMNS = {
  userBadgeId: userBadges.userBadgeId,
  badgeId: badges.badgeId,
  name: badges.name,
  description: badges.description,
  earnedAt: userBadges.earnedAt,
};

export const USER_RANKING_COLUMNS = {
  userId: userRanking.userId,
  globalRank: userRanking.allTimeRank,
  totalScore: userRanking.allTimeXp,
  updatedAt: userRanking.updatedAt,
};

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

  async listUserBadges(params: {
    userId: string;
    limit: number;
    cursor?: { earnedAt: string; userBadgeId: string } | null;
  }): Promise<UserBadgeRow[]> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${userBadges.earnedAt} < ${cursor.earnedAt}`,
          and(
            eq(userBadges.earnedAt, cursor.earnedAt),
            sql`${userBadges.userBadgeId} < ${cursor.userBadgeId}`,
          ),
        )
      : undefined;

    const baseCondition = and(
      eq(userBadges.userId, userId),
      isNull(userBadges.revokedAt),
      eq(badges.isActive, true),
      eq(badges.isHidden, false),
    );

    const whereClause = cursorCondition ? and(baseCondition, cursorCondition) : baseCondition;

    return this.db
      .select(USER_BADGE_COLUMNS)
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(whereClause)
      .orderBy(desc(userBadges.earnedAt), desc(userBadges.userBadgeId))
      .limit(limit + 1);
  }

  async getUserRanking(userId: string): Promise<UserRankingRow | null> {
    const [ranking] = await this.db
      .select(USER_RANKING_COLUMNS)
      .from(userRanking)
      .innerJoin(users, eq(userRanking.userId, users.userId))
      .where(and(eq(userRanking.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    return ranking ?? null;
  }

  async getUserAnalytics(userId: string): Promise<UserAnalytics | null> {
    const [summary] = await this.db
      .select({
        totalAttempts: count(),
        completedQuizzes: sql<number>`COUNT(DISTINCT CASE WHEN ${quizAttempts.status} = 'completed' THEN ${quizVersions.quizId} END)`,
        averageScore: sql<number>`ROUND(COALESCE(AVG(CASE WHEN ${quizAttempts.status} = 'completed' THEN ${quizAttempts.scorePercent}::numeric END), 0), 1)`,
        lastUpdated: sql<string>`MAX(${quizAttempts.updatedAt})`,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(users, eq(quizAttempts.userId, users.userId))
      .where(and(eq(quizAttempts.userId, userId), isNull(users.deletedAt)));

    const totalAttempts = Number(summary?.totalAttempts ?? 0);

    if (totalAttempts === 0) {
      return null;
    }

    const [favoriteCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
        totalAttempts: count(),
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizCategories, eq(quizVersions.quizId, quizCategories.quizId))
      .innerJoin(categories, eq(quizCategories.categoryId, categories.categoryId))
      .innerJoin(users, eq(quizAttempts.userId, users.userId))
      .where(
        and(eq(quizAttempts.userId, userId), isNull(users.deletedAt), isNull(categories.deletedAt)),
      )
      .groupBy(categories.categoryId, categories.name)
      .orderBy(desc(count()), categories.name)
      .limit(1);

    const [favoriteTag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
        totalAttempts: count(),
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .innerJoin(quizTags, eq(quizVersions.quizId, quizTags.quizId))
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .innerJoin(users, eq(quizAttempts.userId, users.userId))
      .where(and(eq(quizAttempts.userId, userId), isNull(users.deletedAt), isNull(tags.deletedAt)))
      .groupBy(tags.tagId, tags.name)
      .orderBy(desc(count()), tags.name)
      .limit(1);

    return {
      userId,
      summary: {
        totalAttempts,
        completedQuizzes: Number(summary?.completedQuizzes ?? 0),
        averageScore: Number(summary?.averageScore ?? 0),
      },
      favoriteCategory: favoriteCategory
        ? {
            categoryId: favoriteCategory.categoryId,
            name: favoriteCategory.name,
          }
        : null,
      favoriteTag: favoriteTag
        ? {
            tagId: favoriteTag.tagId,
            name: favoriteTag.name,
          }
        : null,
      lastUpdated: summary?.lastUpdated ?? new Date().toISOString(),
    };
  }

  async searchUsers(
    query: string,
    limit: number,
    excludeUserId?: string,
  ): Promise<UserSearchResult[]> {
    const searchPattern = `%${query}%`;

    const baseConditions = [
      isNull(users.deletedAt),
      or(ilike(users.username, searchPattern), ilike(userProfiles.displayName, searchPattern)),
    ];

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

  async listUserActivity(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; eventId: string } | null;
  }): Promise<UserActivityRow[]> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${userActivityEvents.createdAt} < ${cursor.createdAt}`,
          and(
            eq(userActivityEvents.createdAt, cursor.createdAt),
            sql`${userActivityEvents.eventId} < ${cursor.eventId}`,
          ),
        )
      : undefined;

    const baseCondition = eq(userActivityEvents.userId, userId);
    const whereClause = cursorCondition ? and(baseCondition, cursorCondition) : baseCondition;

    const rows = await this.db
      .select({
        eventId: userActivityEvents.eventId,
        eventType: userActivityEvents.eventType,
        createdAt: userActivityEvents.createdAt,
        metadata: userActivityEvents.metadata,
      })
      .from(userActivityEvents)
      .where(whereClause)
      .orderBy(desc(userActivityEvents.createdAt), desc(userActivityEvents.eventId))
      .limit(limit + 1);

    return rows;
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
