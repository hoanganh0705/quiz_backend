import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  badges,
  tournamentParticipants,
  tournaments,
  userActivityEvents,
  userBadges,
  userProfiles,
  userProfileSettings,
  userRanking,
  users,
} from '@/core/database/schema';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { UserAnalytics } from '../../domain/types/user-analytics';
import type {
  MyTournamentAnalyticsRow,
  MyTournamentHistoryRow,
  MyTournamentRow,
  PublicTournamentProfileRow,
  StreakCacheUpdateResult,
  UserActivityRow,
  UserBadgeRow,
  UserMeRow,
  UserPublicRow,
  UserRankingRow,
  UserRepositoryPort,
  ModeratorRole,
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
        // `xpTotal` is sourced via LEFT JOIN so the profile endpoint
        // reflects the authoritative `user_ranking.all_time_xp`. We
        // coalesce NULL to 0 to preserve the contract: a user with no
        // ranking row reads as 0 XP rather than `null`. See
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

  async createUserRanking(userId: string): Promise<UserRankingRow> {
    const [result] = await this.db
      .insert(userRanking)
      .values({ userId })
      .returning(USER_RANKING_COLUMNS);

    return result as UserRankingRow;
  }

  /**
   * Combined user analytics in a single round-trip.
   *
   * Replaces three separate aggregations (summary, favorite category,
   * favorite tag) with one query that uses CTEs and `ROW_NUMBER()` so
   * `quiz_attempts` is scanned only once and the favorites are
   * determined in the same pass.
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const result = await this.db.execute(
      sql<{
        totalAttempts: number | string;
        completedQuizzes: number | string;
        averageScore: number | string;
        lastUpdated: string | null;
        favoriteCategoryId: string | null;
        favoriteCategoryName: string | null;
        favoriteTagId: string | null;
        favoriteTagName: string | null;
      }>`
        WITH summary AS (
          SELECT
            COUNT(*)::int AS "totalAttempts",
            COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN v.quiz_id END)::int AS "completedQuizzes",
            ROUND(
              COALESCE(
                AVG(CASE WHEN a.status = 'completed' THEN a.score_percent::numeric END),
                0
              ),
              1
            ) AS "averageScore",
            MAX(a.updated_at) AS "lastUpdated"
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
        ),
        category_counts AS (
          SELECT
            c.category_id AS "categoryId",
            c.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, c.name ASC) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quizzes q ON q.quiz_id = v.quiz_id
          INNER JOIN categories c ON c.category_id = q.category_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
            AND c.deleted_at IS NULL
          GROUP BY c.category_id, c.name
        ),
        tag_counts AS (
          SELECT
            t.tag_id AS "tagId",
            t.name AS "name",
            COUNT(*)::bigint AS cnt,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, t.name ASC) AS rn
          FROM quiz_attempts a
          INNER JOIN quiz_versions v ON v.quiz_version_id = a.quiz_version_id
          INNER JOIN quiz_tags qt ON qt.quiz_id = v.quiz_id
          INNER JOIN tags t ON t.tag_id = qt.tag_id
          INNER JOIN users u ON u.user_id = a.user_id
          WHERE a.user_id = ${userId}::uuid
            AND u.deleted_at IS NULL
            AND t.deleted_at IS NULL
          GROUP BY t.tag_id, t.name
        )
        SELECT
          s."totalAttempts",
          s."completedQuizzes",
          s."averageScore",
          s."lastUpdated",
          (SELECT "categoryId" FROM category_counts WHERE rn = 1) AS "favoriteCategoryId",
          (SELECT "name" FROM category_counts WHERE rn = 1) AS "favoriteCategoryName",
          (SELECT "tagId" FROM tag_counts WHERE rn = 1) AS "favoriteTagId",
          (SELECT "name" FROM tag_counts WHERE rn = 1) AS "favoriteTagName"
        FROM summary s
      `,
    );

    const row = result.rows[0] as
      | {
          totalAttempts: number | string;
          completedQuizzes: number | string;
          averageScore: number | string;
          lastUpdated: string | null;
          favoriteCategoryId: string | null;
          favoriteCategoryName: string | null;
          favoriteTagId: string | null;
          favoriteTagName: string | null;
        }
      | undefined;

    const totalAttempts = Number(row?.totalAttempts ?? 0);

    return {
      userId,
      summary: {
        totalAttempts,
        completedQuizzes: Number(row?.completedQuizzes ?? 0),
        averageScore: Number(row?.averageScore ?? 0),
      },
      favoriteCategory:
        row?.favoriteCategoryId && row?.favoriteCategoryName
          ? { categoryId: row.favoriteCategoryId, name: row.favoriteCategoryName }
          : null,
      favoriteTag:
        row?.favoriteTagId && row?.favoriteTagName
          ? { tagId: row.favoriteTagId, name: row.favoriteTagName }
          : null,
      lastUpdated: row?.lastUpdated ?? new Date().toISOString(),
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

    const rows = await this.db
      .select({
        participantId: tournamentParticipants.participantId,
        tournamentId: tournaments.tournamentId,
        tournamentName: tournaments.title,
        finalRank: tournamentParticipants.rankFinal,
        finalScore: tournamentParticipants.totalScore,
        participantCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${tournamentParticipants} tp2
          WHERE tp2.tournament_id = ${tournaments.tournamentId}
            AND tp2.rank_final IS NOT NULL
        )`,
        completedAt: tournaments.endAt,
      })
      .from(tournamentParticipants)
      .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.tournamentId))
      .innerJoin(users, eq(tournamentParticipants.userId, users.userId))
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
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
          settings: users.settings,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updated) return null;

      // xp_total was dropped in migration 0010 — pull the live XP from
      // the authoritative source via LEFT JOIN, coalesced to 0 when no
      // ranking row exists yet.
      const [ranking] = await tx
        .select({
          xpTotal: sql<number>`COALESCE(${userRanking.allTimeXp}, 0)`,
        })
        .from(userRanking)
        .where(eq(userRanking.userId, userId))
        .limit(1);

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
        xpTotal: ranking?.xpTotal ?? 0,
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

  async findUsersByRole(roles: ModeratorRole[]): Promise<{ userId: string }[]> {
    if (roles.length === 0) return [];

    const rows = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(inArray(users.role, roles), isNull(users.deletedAt)));

    return rows.map((r) => ({ userId: r.userId }));
  }

  /**
   * Atomic streak-cache transition driven by a single completed
   * `quiz_attempts.finished_at`. See
   * `docs/plans/user-streak-system.md` §3.1 for the full algorithm.
   *
   * The §3.1 SQL implements the §1.3 gap rule as a `CASE` over
   * `last_streak_day`, with one extra branch (`$day < last_streak_day`)
   * added in §3.5.1 to defend against out-of-order completion commits —
   * the `GREATEST(...)` clamp on the SET clause prevents the cache from
   * regressing in the same direction.
   *
   * `tx` MUST be supplied so this commit joins the calling transaction
   * (the attempt-completion tx in `AttemptRepository.completeAttemptAndSideEffects`).
   * Returns `null` for soft-deleted users (the `FROM` subselect is empty).
   */
  async updateStreakCache(
    userId: string,
    finishedAt: Date,
    tx: DrizzleDB,
  ): Promise<StreakCacheUpdateResult | null> {
    const client = tx ?? this.db;
    // `$day::date` cast must happen in Postgres so the application
    // server's timezone never leaks into the streak-day comparison. The
    // bound parameter is an ISO-8601 string in UTC.
    const dayIso = finishedAt.toISOString();

    const rows = await client.execute<{
      current_streak: number | string;
      longest_streak: number | string;
      last_streak_day: string | null;
    }>(sql`
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
    `);

    const row = rows.rows[0] as
      | {
          current_streak: number | string;
          longest_streak: number | string;
          last_streak_day: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      currentStreak: Number(row.current_streak),
      longestStreak: Number(row.longest_streak),
      lastStreakDay: row.last_streak_day,
    };
  }
}
