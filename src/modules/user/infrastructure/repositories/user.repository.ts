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
  tournamentParticipants,
  tournaments,
  userActivityEvents,
  userBadges,
  userProfiles,
  userProfileSettings,
  userRanking,
  users,
} from '@/core/database/schema';
import { and, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { UserAnalytics } from '../../domain/types/user-analytics';
import type {
  MyTournamentAnalyticsRow,
  MyTournamentHistoryRow,
  MyTournamentRow,
  PublicTournamentProfileRow,
  UserActivityRow,
  UserBadgeRow,
  UserMeRow,
  UserPublicRow,
  UserRankingRow,
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

  async findUserProfileSettings(userId: string): Promise<{ isPublic: boolean } | null> {
    const [row] = await this.db
      .select({ isPublic: userProfileSettings.isPublic })
      .from(userProfileSettings)
      .where(eq(userProfileSettings.userId, userId))
      .limit(1);

    return row ?? null;
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

    return this.db
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
  }

  async listMyTournaments(params: {
    userId: string;
    limit: number;
    cursor?: { registeredAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentRow[]; hasNextPage: boolean }> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${tournamentParticipants.registeredAt} < ${cursor.registeredAt}`,
          and(
            eq(tournamentParticipants.registeredAt, cursor.registeredAt),
            sql`${tournamentParticipants.participantId} < ${cursor.participantId}`,
          ),
        )
      : undefined;

    const baseConditions = and(
      eq(tournamentParticipants.userId, userId),
      isNull(users.deletedAt),
      isNull(tournaments.deletedAt),
    );

    const whereClause = cursorCondition ? and(baseConditions, cursorCondition) : baseConditions;

    const rows = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournaments.tournamentId,
        name: tournaments.title,
        status: tournaments.status,
        registeredAt: tournamentParticipants.registeredAt,
        startAt: tournaments.startAt,
        endAt: tournaments.endAt,
      })
      .from(tournamentParticipants)
      .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.tournamentId))
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .where(whereClause)
      .orderBy(
        desc(tournamentParticipants.registeredAt),
        desc(tournamentParticipants.participantId),
      )
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      items: items as MyTournamentRow[],
      hasNextPage,
    };
  }

  async listMyTournamentHistory(params: {
    userId: string;
    limit: number;
    cursor?: { completedAt: string; participantId: string } | null;
  }): Promise<{ items: MyTournamentHistoryRow[]; hasNextPage: boolean }> {
    const { userId, limit, cursor } = params;

    const cursorCondition = cursor
      ? or(
          sql`${tournaments.endAt} < ${cursor.completedAt}`,
          and(
            eq(tournaments.endAt, cursor.completedAt),
            sql`${tournamentParticipants.participantId} < ${cursor.participantId}`,
          ),
        )
      : undefined;

    const baseConditions = and(
      eq(tournamentParticipants.userId, userId),
      eq(tournaments.status, 'finished'),
      sql`${tournamentParticipants.rankFinal} IS NOT NULL`,
      isNull(users.deletedAt),
      isNull(tournaments.deletedAt),
    );

    const whereClause = cursorCondition ? and(baseConditions, cursorCondition) : baseConditions;

    const participantCountSubquery = this.db
      .select({
        tournamentId: tournamentParticipants.tournamentId,
        participantCount: count(),
      })
      .from(tournamentParticipants)
      .where(sql`${tournamentParticipants.rankFinal} IS NOT NULL`)
      .groupBy(tournamentParticipants.tournamentId)
      .as('participant_count_subquery');

    const rows = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournaments.tournamentId,
        tournamentName: tournaments.title,
        finalRank: tournamentParticipants.rankFinal,
        finalScore: tournamentParticipants.totalScore,
        participantCount: participantCountSubquery.participantCount,
        completedAt: tournaments.endAt,
      })
      .from(tournamentParticipants)
      .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.tournamentId))
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
      .innerJoin(
        participantCountSubquery,
        eq(tournaments.tournamentId, participantCountSubquery.tournamentId),
      )
      .where(whereClause)
      .orderBy(desc(tournaments.endAt), desc(tournamentParticipants.participantId))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;

    return {
      items: items as MyTournamentHistoryRow[],
      hasNextPage,
    };
  }

  async getPublicTournamentProfile(userId: string): Promise<PublicTournamentProfileRow> {
    const [profile] = await this.db
      .select({
        userId: users.userId,
        tournamentsPlayed: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN 1 END)`,
        tournamentsWon: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL AND ${tournamentParticipants.rankFinal} = 1 THEN 1 END)`,
        bestRank: sql<number | null>`MIN(${tournamentParticipants.rankFinal})`,
        averageRank: sql<
          number | null
        >`ROUND(AVG(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN ${tournamentParticipants.rankFinal}::numeric END))`,
        top10Finishes: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL AND ${tournamentParticipants.rankFinal} <= 10 THEN 1 END)`,
        totalTournamentScore: sql<number>`COALESCE(SUM(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN ${tournamentParticipants.totalScore} ELSE 0 END), 0)`,
        lastTournamentAt: sql<string | null>`MAX(${tournaments.endAt})`,
      })
      .from(users)
      .leftJoin(
        tournamentParticipants,
        and(
          eq(users.userId, tournamentParticipants.userId),
          sql`${tournamentParticipants.rankFinal} IS NOT NULL`,
        ),
      )
      .leftJoin(
        tournaments,
        and(
          eq(tournamentParticipants.tournamentId, tournaments.tournamentId),
          eq(tournaments.status, 'finished'),
          isNull(tournaments.deletedAt),
        ),
      )
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .groupBy(users.userId)
      .limit(1);

    return {
      userId,
      tournamentsPlayed: Number(profile?.tournamentsPlayed ?? 0),
      tournamentsWon: Number(profile?.tournamentsWon ?? 0),
      bestRank: profile?.bestRank ?? null,
      averageRank: profile?.averageRank ?? null,
      top10Finishes: Number(profile?.top10Finishes ?? 0),
      totalTournamentScore: Number(profile?.totalTournamentScore ?? 0),
      lastTournamentAt: profile?.lastTournamentAt ?? null,
    };
  }

  async getMyTournamentAnalytics(userId: string): Promise<MyTournamentAnalyticsRow> {
    const [analytics] = await this.db
      .select({
        tournamentsPlayed: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN 1 END)`,
        wins: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL AND ${tournamentParticipants.rankFinal} = 1 THEN 1 END)`,
        top3Finishes: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL AND ${tournamentParticipants.rankFinal} <= 3 THEN 1 END)`,
        top10Finishes: sql<number>`COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL AND ${tournamentParticipants.rankFinal} <= 10 THEN 1 END)`,
        averageRank: sql<
          number | null
        >`ROUND(AVG(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN ${tournamentParticipants.rankFinal}::numeric END))`,
        bestRank: sql<number | null>`MIN(${tournamentParticipants.rankFinal})`,
        averageScore: sql<number>`COALESCE(ROUND(AVG(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN ${tournamentParticipants.totalScore}::numeric END)), 0)`,
        totalTournamentScore: sql<number>`COALESCE(SUM(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN ${tournamentParticipants.totalScore} ELSE 0 END), 0)`,
        completionRate: sql<number>`COALESCE(ROUND((COUNT(CASE WHEN ${tournaments.tournamentId} IS NOT NULL THEN 1 END)::numeric * 100.0) / NULLIF(COUNT(${tournamentParticipants.participantId}), 0)), 0)`,
        lastTournamentAt: sql<string | null>`MAX(${tournaments.endAt})`,
      })
      .from(users)
      .leftJoin(tournamentParticipants, eq(users.userId, tournamentParticipants.userId))
      .leftJoin(
        tournaments,
        and(
          eq(tournamentParticipants.tournamentId, tournaments.tournamentId),
          eq(tournaments.status, 'finished'),
          isNull(tournaments.deletedAt),
          sql`${tournamentParticipants.rankFinal} IS NOT NULL`,
        ),
      )
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .groupBy(users.userId)
      .limit(1);

    return {
      tournamentsPlayed: Number(analytics?.tournamentsPlayed ?? 0),
      wins: Number(analytics?.wins ?? 0),
      top3Finishes: Number(analytics?.top3Finishes ?? 0),
      top10Finishes: Number(analytics?.top10Finishes ?? 0),
      averageRank: analytics?.averageRank ?? null,
      bestRank: analytics?.bestRank ?? null,
      averageScore: Number(analytics?.averageScore ?? 0),
      totalTournamentScore: Number(analytics?.totalTournamentScore ?? 0),
      completionRate: Number(analytics?.completionRate ?? 0),
      lastTournamentAt: analytics?.lastTournamentAt ?? null,
    };
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.db.transaction(async (tx) => {
      await tx
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

      const [user] = await tx
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
    });
  }

  async updateSettings(
    userId: string,
    settings: Record<string, unknown>,
    nowIso: string,
  ): Promise<UserMeRow | null> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
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

      const [profile] = await tx
        .select({
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
          bio: userProfiles.bio,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      return {
        ...updated,
        settings: updated.settings as Record<string, unknown>,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        bio: profile?.bio ?? null,
      };
    });
  }

  async findByUsernames(usernames: string[]): Promise<UserPublicRow[]> {
    if (usernames.length === 0) return [];

    const rows = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(inArray(users.username, usernames), isNull(users.deletedAt)));

    return rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
    }));
  }
}
