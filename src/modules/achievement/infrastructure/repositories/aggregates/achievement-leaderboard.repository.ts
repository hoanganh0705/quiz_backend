import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, asc, desc, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import { badges, userBadges, userRanking, users } from '@/core/database/schema';
import type { PublicAchievementProfileRow, FeaturedBadgeRow } from '../achievement.repository';
import { computeRarityString } from '../../../domain/constants/achievement.constants';

const NULL_RANK_SENTINEL = 2147483647;

@Injectable()
export class AchievementLeaderboardRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectPinoLogger(AchievementLeaderboardRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async getPublicAchievementProfile(userId: string): Promise<PublicAchievementProfileRow | null> {
    const userRows = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    if (userRows.length === 0) {
      return null;
    }

    const aggregateRows = await this.db
      .select({
        totalBadges: sql<number>`COUNT(${userBadges.userBadgeId})::int`,
        highestRank: sql<number | null>`MIN(
          LEAST(
            COALESCE(${userRanking.allTimeRank}, ${NULL_RANK_SENTINEL}),
            COALESCE(${userRanking.weeklyRank}, ${NULL_RANK_SENTINEL}),
            COALESCE(${userRanking.monthlyRank}, ${NULL_RANK_SENTINEL})
          )
        )`,
      })
      .from(users)
      .leftJoin(userBadges, and(eq(userBadges.userId, users.userId), isNull(userBadges.revokedAt)))
      .leftJoin(userRanking, eq(userRanking.userId, users.userId))
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .groupBy(users.userId)
      .limit(1);

    const featuredRows = await this.db
      .select({
        badgeId: badges.badgeId,
        badgeName: badges.name,
        earnedCount: sql<number>`COUNT(${userBadges.userBadgeId}) OVER (PARTITION BY ${badges.badgeId})::int`,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(
        asc(sql`COUNT(${userBadges.userBadgeId}) OVER (PARTITION BY ${badges.badgeId})`),
        desc(userBadges.earnedAt),
      )
      .limit(5);

    const featuredBadges: FeaturedBadgeRow[] = featuredRows.map((row) => ({
      badgeId: row.badgeId,
      badgeName: row.badgeName,
      rarity: computeRarityString(row.earnedCount),
    }));

    const rareBadges = featuredBadges.filter((badge) =>
      ['rare', 'epic', 'legendary'].includes(badge.rarity),
    ).length;
    const aggregate = aggregateRows[0];

    return {
      userId,
      totalBadges: aggregate?.totalBadges ?? 0,
      rareBadges,
      highestRank:
        aggregate?.highestRank !== null &&
        aggregate?.highestRank !== undefined &&
        aggregate.highestRank < NULL_RANK_SENTINEL
          ? aggregate.highestRank
          : null,
      featuredBadges,
    };
  }

  async getUsersEligibleForStreakBadge(
    minStreakDays: number,
    excludeBadgeId: string,
    limit = 1000,
    offset = 0,
  ): Promise<{ userId: string; currentStreak: number }[]> {
    const results = await this.db
      .select({
        userId: users.userId,
        currentStreak: users.currentStreak,
      })
      .from(users)
      .leftJoin(
        userBadges,
        and(
          eq(userBadges.userId, users.userId),
          eq(userBadges.badgeId, excludeBadgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .where(
        and(
          sql`${users.currentStreak} >= ${minStreakDays}`,
          sql`${users.currentStreak} > 0`,
          sql`${users.deletedAt} IS NULL`,
        ),
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return results
      .filter((row) => row.currentStreak !== null)
      .map((row) => ({
        userId: row.userId,
        currentStreak: row.currentStreak ?? 0,
      }));
  }

  async getUsersEligibleForRankBadge(
    maxRank: number,
    period: string,
    excludeBadgeId: string,
    limit = 1000,
    offset = 0,
  ): Promise<{ userId: string; currentRank: number }[]> {
    const rankColumn =
      period === 'daily'
        ? userRanking.dailyRank
        : period === 'weekly'
          ? userRanking.weeklyRank
          : period === 'monthly'
            ? userRanking.monthlyRank
            : userRanking.allTimeRank;

    const results = await this.db
      .select({
        userId: users.userId,
        currentRank: rankColumn,
      })
      .from(users)
      .innerJoin(userRanking, eq(userRanking.userId, users.userId))
      .leftJoin(
        userBadges,
        and(
          eq(userBadges.userId, users.userId),
          eq(userBadges.badgeId, excludeBadgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .where(
        and(
          sql`${rankColumn} IS NOT NULL`,
          sql`${rankColumn} <= ${maxRank}`,
          sql`${users.deletedAt} IS NULL`,
        ),
      )
      .limit(limit)
      .offset(offset)
      .execute();

    return results
      .filter((row) => row.currentRank !== null)
      .map((row) => ({
        userId: row.userId,
        currentRank: row.currentRank ?? 0,
      }));
  }
}
