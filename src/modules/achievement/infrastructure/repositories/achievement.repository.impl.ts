/**
 * Achievement Repository Implementation
 *
 * Database-backed implementation using Drizzle ORM.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, desc, isNull, count, sql, asc, gt, inArray } from 'drizzle-orm';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import {
  badges,
  badgeRules,
  userBadges,
  userRanking,
  users,
  badgeType,
  badgeCategory,
  badgeRuleType,
  outboxEvents,
} from '@/core/database/schema';
import type { AchievementRepositoryPort } from './achievement.repository';
import type {
  BadgeCatalogRow,
  BadgeDetailsRow,
  UserBadgeRow,
  BadgeDefinitionRow,
  BadgeRuleRow,
  PublicAchievementProfileRow,
  FeaturedBadgeRow,
  RevokedBadgeRecord,
} from './achievement.repository';
import {
  RARITY_THRESHOLDS,
  computeRarityString,
} from '../../domain/constants/achievement.constants';

@Injectable()
export class AchievementRepository implements AchievementRepositoryPort {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectPinoLogger(AchievementRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async hasBadge(userId: string, badgeId: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId),
          isNull(userBadges.revokedAt),
        ),
      );

    return (result[0]?.count ?? 0) > 0;
  }

  async hasBadges(userId: string, badgeIds: string[]): Promise<Record<string, boolean>> {
    if (badgeIds.length === 0) return {};

    const results = await this.db
      .select({ badgeId: userBadges.badgeId })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          inArray(userBadges.badgeId, badgeIds),
          isNull(userBadges.revokedAt),
        ),
      );

    const owned = new Set(results.map((r) => r.badgeId));
    const map: Record<string, boolean> = {};
    for (const badgeId of badgeIds) {
      map[badgeId] = owned.has(badgeId);
    }
    return map;
  }

  async awardBadge(params: {
    userId: string;
    badgeId: string;
    badgeVersion?: string;
    earnedAt?: Date;
    progress?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<UserBadgeRow | null> {
    const nowIso = new Date().toISOString();
    const earnedAt = (params.earnedAt ?? new Date()).toISOString();
    const expiresAt = params.expiresAt ? params.expiresAt.toISOString() : null;

    let inserted: typeof userBadges.$inferSelect | null = null;

    await this.db.transaction(async (tx) => {
      try {
        const [row] = await tx
          .insert(userBadges)
          .values({
            userId: params.userId,
            badgeId: params.badgeId,
            badgeVersion: params.badgeVersion ?? '1.0.0',
            earnedAt,
            progress: params.progress ?? {},
            metadata: params.metadata ?? {},
            expiresAt,
          })
          .returning()
          .execute();

        if (!row) {
          throw new Error(`Failed to award badge ${params.badgeId} to user ${params.userId}`);
        }

        inserted = row;

        await tx
          .insert(outboxEvents)
          .values({
            aggregateType: 'Achievement',
            eventType: 'achievement.awarded',
            payload: {
              userId: params.userId,
              badgeId: params.badgeId,
              metadata: params.metadata,
            },
            createdAt: nowIso,
            // Producer-side idempotency: a (user, badge) pair can only
            // be awarded once (the user_badges table enforces this
            // elsewhere too). Using the same key for the outbox event
            // means a retried award of the same (user, badge) silently
            // drops the duplicate outbox row at this INSERT.
            //
            // The `where` clause must match the partial unique index
            // `uq_outbox_events_idempotency_unprocessed` verbatim so
            // Postgres can infer the index for ON CONFLICT.
            idempotencyKey: `achievement:awarded:${params.userId}:${params.badgeId}`,
          })
          .onConflictDoNothing({
            target: outboxEvents.idempotencyKey,
            where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
          });
      } catch (error) {
        if (isPostgresUniqueViolation(error)) {
          this.logger.debug({
            event: 'badge_award_skipped_duplicate',
            userId: params.userId,
            badgeId: params.badgeId,
          });
          return;
        }
        throw error;
      }
    });

    if (!inserted) {
      return null;
    }

    this.logger.info({
      event: 'badge_awarded',
      userId: params.userId,
      badgeId: params.badgeId,
    });

    return this.mapUserBadgeRow(inserted);
  }

  async getUserBadges(userId: string): Promise<UserBadgeRow[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(desc(userBadges.earnedAt));

    return results.map((row) => this.mapUserBadgeRow(row));
  }

  async getUserBadgesWithDetails(
    userId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{
    data: (UserBadgeRow & { badge: BadgeDefinitionRow })[];
    total: number;
  }> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [results, countResult] = await Promise.all([
      this.db
        .select()
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
        .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
        .orderBy(desc(userBadges.earnedAt))
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
        .execute(),
    ]);

    return {
      data: results.map((row) => ({
        ...this.mapUserBadgeRow(row.user_badges),
        badge: this.mapBadgeRow(row.badges),
      })),
      total: countResult[0]?.count ?? 0,
    };
  }

  async getBadgeCatalog(params?: { limit?: number; offset?: number; category?: string }): Promise<{
    data: BadgeCatalogRow[];
    total: number;
  }> {
    const rarityRank = sql<number>`CASE
      WHEN COUNT(${userBadges.userBadgeId}) >= ${RARITY_THRESHOLDS.COMMON} THEN 5
      WHEN COUNT(${userBadges.userBadgeId}) >= ${RARITY_THRESHOLDS.UNCOMMON} THEN 4
      WHEN COUNT(${userBadges.userBadgeId}) >= ${RARITY_THRESHOLDS.RARE} THEN 3
      WHEN COUNT(${userBadges.userBadgeId}) >= ${RARITY_THRESHOLDS.EPIC} THEN 2
      ELSE 1
    END`;

    const baseQuery = this.db
      .select({
        badgeId: badges.badgeId,
        name: badges.name,
        description: badges.description,
        earnedCount: sql<number>`COUNT(${userBadges.userBadgeId})::int`,
        rarityRank,
      })
      .from(badges)
      .leftJoin(
        userBadges,
        and(eq(userBadges.badgeId, badges.badgeId), isNull(userBadges.revokedAt)),
      )
      .where(eq(badges.isActive, true))
      .groupBy(badges.badgeId, badges.name, badges.description)
      .orderBy(desc(rarityRank), asc(badges.name));

    const [results, countResult] = await Promise.all([
      baseQuery
        .limit(params?.limit ?? 50)
        .offset(params?.offset ?? 0)
        .execute(),
      this.db.select({ count: count() }).from(badges).where(eq(badges.isActive, true)).execute(),
    ]);

    return {
      data: results.map((row) => ({
        badgeId: row.badgeId,
        name: row.name,
        description: row.description,
        rarity: this.mapBadgeRarity(row.earnedCount),
        earnedCount: row.earnedCount,
      })),
      total: countResult[0]?.count ?? 0,
    };
  }

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
            COALESCE(${userRanking.allTimeRank}, 2147483647),
            COALESCE(${userRanking.weeklyRank}, 2147483647),
            COALESCE(${userRanking.monthlyRank}, 2147483647)
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
      rarity: this.mapBadgeRarity(row.earnedCount),
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
        aggregate.highestRank < 2147483647
          ? aggregate.highestRank
          : null,
      featuredBadges,
    };
  }

  async getBadgeDetailsById(badgeId: string): Promise<BadgeDetailsRow | null> {
    const results = await this.db
      .select({
        badgeId: badges.badgeId,
        name: badges.name,
        description: badges.description,
        earnedCount: sql<number>`COUNT(${userBadges.userBadgeId})::int`,
      })
      .from(badges)
      .leftJoin(
        userBadges,
        and(eq(userBadges.badgeId, badges.badgeId), isNull(userBadges.revokedAt)),
      )
      .where(eq(badges.badgeId, badgeId))
      .groupBy(badges.badgeId, badges.name, badges.description)
      .limit(1);

    const row = results[0];
    if (!row) {
      return null;
    }

    const badgeDetails: BadgeDetailsRow = {
      badgeId: row.badgeId,
      name: row.name,
      description: row.description,
      rarity: this.mapBadgeRarity(row.earnedCount),
      earnedCount: row.earnedCount,
    };

    return badgeDetails;
  }

  async getBadgeById(badgeId: string): Promise<BadgeDefinitionRow | null> {
    const results = await this.db.select().from(badges).where(eq(badges.badgeId, badgeId)).limit(1);

    if (results.length === 0) return null;

    return this.mapBadgeRow(results[0]);
  }

  async getBadgeBySlug(slug: string): Promise<BadgeDefinitionRow | null> {
    const results = await this.db.select().from(badges).where(eq(badges.slug, slug)).limit(1);

    if (results.length === 0) return null;

    return this.mapBadgeRow(results[0]);
  }

  async getBadgesByIds(badgeIds: string[]): Promise<BadgeDefinitionRow[]> {
    if (badgeIds.length === 0) return [];

    const results = await this.db.select().from(badges).where(inArray(badges.badgeId, badgeIds));

    return results.map((row) => this.mapBadgeRow(row));
  }

  async getAllActiveBadges(): Promise<BadgeDefinitionRow[]> {
    const results = await this.db.select().from(badges).where(eq(badges.isActive, true));

    return results.filter((row) => this.isBadgeValid(row)).map((row) => this.mapBadgeRow(row));
  }

  async getBadgeRules(badgeId: string): Promise<BadgeRuleRow[]> {
    const results = await this.db
      .select()
      .from(badgeRules)
      .where(and(eq(badgeRules.badgeId, badgeId), eq(badgeRules.isActive, true)))
      .orderBy(desc(badgeRules.priority));

    return results.map((row) => this.mapBadgeRuleRow(row));
  }

  async getAllActiveRules(): Promise<BadgeRuleRow[]> {
    const results = await this.db
      .select()
      .from(badgeRules)
      .innerJoin(badges, eq(badgeRules.badgeId, badges.badgeId))
      .where(and(eq(badgeRules.isActive, true), eq(badges.isActive, true)))
      .orderBy(desc(badgeRules.priority));

    return results.map((row) => this.mapBadgeRuleRow(row.badge_rules));
  }

  async getRulesByType(
    ruleType: (typeof badgeRuleType.enumValues)[number],
  ): Promise<BadgeRuleRow[]> {
    const results = await this.db
      .select()
      .from(badgeRules)
      .innerJoin(badges, eq(badgeRules.badgeId, badges.badgeId))
      .where(
        and(
          eq(badgeRules.ruleType, ruleType),
          eq(badgeRules.isActive, true),
          eq(badges.isActive, true),
        ),
      )
      .orderBy(desc(badgeRules.priority));

    return results.map((row) => this.mapBadgeRuleRow(row.badge_rules));
  }

  async getBadgesByCategory(
    category: (typeof badgeCategory.enumValues)[number],
  ): Promise<BadgeDefinitionRow[]> {
    const results = await this.db
      .select()
      .from(badges)
      .where(and(eq(badges.category, category), eq(badges.isActive, true)));

    return results.filter((row) => this.isBadgeValid(row)).map((row) => this.mapBadgeRow(row));
  }

  async updateBadgeProgress(
    userId: string,
    badgeId: string,
    progress: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(userBadges)
      .set({ progress })
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .execute();
  }

  async getBadgeProgress(userId: string, badgeId: string): Promise<Record<string, unknown> | null> {
    const results = await this.db
      .select({ progress: userBadges.progress })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .limit(1);

    if (results.length === 0) return null;
    return results[0].progress as Record<string, unknown>;
  }

  async getBadgeProgressBatch(
    userId: string,
    badgeIds: string[],
  ): Promise<Record<string, Record<string, unknown> | null>> {
    if (badgeIds.length === 0) return {};

    const results = await this.db
      .select({
        badgeId: userBadges.badgeId,
        progress: userBadges.progress,
      })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          inArray(userBadges.badgeId, badgeIds),
          isNull(userBadges.revokedAt),
        ),
      );

    const map: Record<string, Record<string, unknown> | null> = {};
    for (const row of results) {
      map[row.badgeId] = row.progress as Record<string, unknown> | null;
    }
    return map;
  }

  async revokeBadge(
    userId: string,
    badgeId: string,
    reason: string,
  ): Promise<RevokedBadgeRecord | null> {
    const nowIso = new Date().toISOString();

    return this.db.transaction(async (tx) => {
      const results = await tx
        .update(userBadges)
        .set({
          revokedAt: nowIso,
          revocationReason: reason,
        })
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId),
            isNull(userBadges.revokedAt),
          ),
        )
        .returning();

      const revokedRow = results[0];
      if (!revokedRow) {
        return null;
      }

      const badgeResults = await tx
        .select({
          badgeSlug: badges.slug,
          badgeName: badges.name,
        })
        .from(badges)
        .where(eq(badges.badgeId, badgeId))
        .limit(1);

      const badgeRow = badgeResults[0];

      await tx
        .insert(outboxEvents)
        .values({
          aggregateType: 'Achievement',
          eventType: 'achievement.revoked',
          payload: {
            userId,
            badgeId,
            badgeSlug: badgeRow?.badgeSlug ?? '',
            revokedAt: nowIso,
            reason,
          },
          createdAt: nowIso,
          // Producer-side idempotency: include the timestamp in the
          // key so a re-revocation of the same badge (after a prior
          // award-revoke-award-revoke cycle) gets a distinct key and
          // is not silently dropped. Without the timestamp, the
          // second revocation would collide on (user, badge) and
          // never get scheduled.
          //
          // The `where` clause must match the partial unique index
          // verbatim so Postgres can infer the index for ON CONFLICT.
          idempotencyKey: `achievement:revoked:${userId}:${badgeId}:${nowIso}`,
        })
        .onConflictDoNothing({
          target: outboxEvents.idempotencyKey,
          where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
        });

      this.logger.info({
        event: 'badge_revoked',
        userId,
        badgeId,
        reason,
      });

      return {
        userBadgeId: revokedRow.userBadgeId,
        userId: revokedRow.userId,
        badgeId: revokedRow.badgeId,
        badgeSlug: badgeRow?.badgeSlug ?? '',
        badgeName: badgeRow?.badgeName ?? '',
        revokedAt: this.toDate(revokedRow.revokedAt) ?? new Date(),
        revocationReason: revokedRow.revocationReason ?? reason,
      };
    });
  }

  isBadgeValid(badge: {
    validFrom: Date | string | null;
    validUntil: Date | string | null;
  }): boolean {
    const now = new Date();
    const validFrom =
      typeof badge.validFrom === 'string' ? new Date(badge.validFrom) : badge.validFrom;
    const validUntil =
      typeof badge.validUntil === 'string' ? new Date(badge.validUntil) : badge.validUntil;
    if (validFrom && now < validFrom) return false;
    if (validUntil && now > validUntil) return false;
    return true;
  }

  async getRecentUserBadges(userId: string, limit = 5): Promise<UserBadgeRow[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(desc(userBadges.earnedAt))
      .limit(limit);

    return results.map((row) => this.mapUserBadgeRow(row));
  }

  async countUserBadges(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)));

    return result[0]?.count ?? 0;
  }

  async countUserBadgesByType(
    userId: string,
    type: (typeof badgeType.enumValues)[number],
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(
        and(eq(userBadges.userId, userId), eq(badges.type, type), isNull(userBadges.revokedAt)),
      );

    return result[0]?.count ?? 0;
  }

  async getBadgeEarnersCount(badgeId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .where(and(eq(userBadges.badgeId, badgeId), isNull(userBadges.revokedAt)));

    return result[0]?.count ?? 0;
  }

  async getBadgeEarnersCounts(badgeIds: string[]): Promise<Record<string, number>> {
    if (badgeIds.length === 0) return {};

    const results = await this.db
      .select({
        badgeId: userBadges.badgeId,
        count: count(),
      })
      .from(userBadges)
      .where(and(isNull(userBadges.revokedAt), inArray(userBadges.badgeId, badgeIds)))
      .groupBy(userBadges.badgeId);

    const map: Record<string, number> = {};
    for (const row of results) {
      map[row.badgeId] = row.count;
    }
    return map;
  }

  async getBadgeEarnersCountTimeline(badgeId: string): Promise<{
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [last24Hours, last7Days, last30Days] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(
          and(
            eq(userBadges.badgeId, badgeId),
            isNull(userBadges.revokedAt),
            gt(userBadges.earnedAt, dayAgo.toISOString()),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(
          and(
            eq(userBadges.badgeId, badgeId),
            isNull(userBadges.revokedAt),
            gt(userBadges.earnedAt, weekAgo.toISOString()),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(
          and(
            eq(userBadges.badgeId, badgeId),
            isNull(userBadges.revokedAt),
            gt(userBadges.earnedAt, monthAgo.toISOString()),
          ),
        ),
    ]);

    return {
      last24Hours: last24Hours[0]?.count ?? 0,
      last7Days: last7Days[0]?.count ?? 0,
      last30Days: last30Days[0]?.count ?? 0,
    };
  }

  async getDistinctBadgeEarners(): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ userId: userBadges.userId })
      .from(userBadges)
      .where(isNull(userBadges.revokedAt));

    return results.map((row) => row.userId);
  }

  async getUsersEligibleForStreakBadge(
    minStreakDays: number,
    excludeBadgeId: string,
    limit = 1000,
    offset = 0,
  ): Promise<{ userId: string; currentStreak: number }[]> {
    // Get users who have streak meeting threshold but don't already have this badge
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
    // Determine which rank column to use from userRanking table based on period
    const rankColumn =
      period === 'daily'
        ? userRanking.dailyRank
        : period === 'weekly'
          ? userRanking.weeklyRank
          : period === 'monthly'
            ? userRanking.monthlyRank
            : userRanking.allTimeRank;

    // Get users who have rank meeting threshold but don't already have this badge
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

  async getUserBadgeById(
    userBadgeId: string,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow }) | null> {
    const results = await this.db
      .select()
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(eq(userBadges.userBadgeId, userBadgeId))
      .limit(1)
      .execute();

    if (results.length === 0) return null;

    return {
      ...this.mapUserBadgeRow(results[0].user_badges),
      badge: this.mapBadgeRow(results[0].badges),
    };
  }

  async getRevokedUserBadges(
    userId?: string,
    badgeId?: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [sql`${userBadges.revokedAt} IS NOT NULL`];
    if (userId) {
      conditions.push(eq(userBadges.userId, userId));
    }
    if (badgeId) {
      conditions.push(eq(userBadges.badgeId, badgeId));
    }

    const [results, countResult] = await Promise.all([
      this.db
        .select()
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
        .where(and(...conditions))
        .orderBy(desc(userBadges.revokedAt))
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(and(...conditions))
        .execute(),
    ]);

    return {
      data: results.map((row) => ({
        ...this.mapUserBadgeRow(row.user_badges),
        badge: this.mapBadgeRow(row.badges),
      })),
      total: countResult[0]?.count ?? 0,
    };
  }

  async getRecentAwards(
    limit = 20,
  ): Promise<{ userId: string; badgeId: string; earnedAt: Date }[]> {
    const results = await this.db
      .select({
        userId: userBadges.userId,
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .where(isNull(userBadges.revokedAt))
      .orderBy(desc(userBadges.earnedAt))
      .limit(limit)
      .execute();

    return results.map((row) => ({
      userId: row.userId,
      badgeId: row.badgeId,
      earnedAt: this.toDate(row.earnedAt) ?? new Date(),
    }));
  }

  async getAwardsByCategory(
    category: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [results, countResult] = await Promise.all([
      this.db
        .select()
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
        .where(
          and(
            eq(badges.category, category as (typeof badgeCategory.enumValues)[number]),
            isNull(userBadges.revokedAt),
          ),
        )
        .orderBy(desc(userBadges.earnedAt))
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
        .where(
          and(
            eq(badges.category, category as (typeof badgeCategory.enumValues)[number]),
            isNull(userBadges.revokedAt),
          ),
        )
        .execute(),
    ]);

    return {
      data: results.map((row) => ({
        ...this.mapUserBadgeRow(row.user_badges),
        badge: this.mapBadgeRow(row.badges),
      })),
      total: countResult[0]?.count ?? 0,
    };
  }

  async getBadgeAwards(
    badgeId: string,
    options: { limit?: number; offset?: number; includeRevoked?: boolean } = {},
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = options.includeRevoked
      ? [eq(userBadges.badgeId, badgeId)]
      : [eq(userBadges.badgeId, badgeId), isNull(userBadges.revokedAt)];

    const [results, countResult] = await Promise.all([
      this.db
        .select()
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
        .where(and(...conditions))
        .orderBy(desc(userBadges.earnedAt))
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(userBadges)
        .where(eq(userBadges.badgeId, badgeId))
        .execute(),
    ]);

    return {
      data: results.map((row) => ({
        ...this.mapUserBadgeRow(row.user_badges),
        badge: this.mapBadgeRow(row.badges),
      })),
      total: countResult[0]?.count ?? 0,
    };
  }

  async getBadgeTopEarners(
    badgeId: string,
    limit = 10,
  ): Promise<{ userId: string; earnedAt: Date }[]> {
    const results = await this.db
      .select({
        userId: userBadges.userId,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .where(and(eq(userBadges.badgeId, badgeId), isNull(userBadges.revokedAt)))
      .orderBy(asc(userBadges.earnedAt))
      .limit(limit)
      .execute();

    return results.map((row) => ({
      userId: row.userId,
      earnedAt: this.toDate(row.earnedAt) ?? new Date(),
    }));
  }

  async getAwardTrendData(
    badgeIds: string[],
    days: number,
  ): Promise<{ date: string; badgeId: string; count: number }[]> {
    if (badgeIds.length === 0) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.db
      .select({
        date: sql<string>`DATE(${userBadges.earnedAt})`,
        badgeId: userBadges.badgeId,
        count: count(),
      })
      .from(userBadges)
      .where(
        and(
          inArray(userBadges.badgeId, badgeIds),
          isNull(userBadges.revokedAt),
          gt(userBadges.earnedAt, startDate.toISOString()),
        ),
      )
      .groupBy(sql`DATE(${userBadges.earnedAt})`, userBadges.badgeId)
      .orderBy(sql`DATE(${userBadges.earnedAt})`)
      .execute();

    return results.map((row) => ({
      date: row.date,
      badgeId: row.badgeId,
      count: Number(row.count),
    }));
  }

  private mapBadgeRarity(earnedCount: number): string {
    return computeRarityString(earnedCount);
  }

  private toDate(value: string | Date | null): Date | null {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  }

  private mapUserBadgeRow(row: typeof userBadges.$inferSelect): UserBadgeRow {
    return {
      userBadgeId: row.userBadgeId,
      userId: row.userId,
      badgeId: row.badgeId,
      earnedAt: this.toDate(row.earnedAt) ?? new Date(0),
      badgeVersion: row.badgeVersion,
      progress: row.progress as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      expiresAt: this.toDate(row.expiresAt),
      revokedAt: this.toDate(row.revokedAt),
      revocationReason: row.revocationReason,
    };
  }

  private mapBadgeRow(row: typeof badges.$inferSelect): BadgeDefinitionRow {
    return {
      badgeId: row.badgeId,
      slug: row.slug,
      type: row.type,
      category: row.category,
      name: row.name,
      description: row.description,
      iconUrl: row.iconUrl,
      isActive: row.isActive,
      isHidden: row.isHidden,
      version: row.version,
      validFrom: this.toDate(row.validFrom),
      validUntil: this.toDate(row.validUntil),
      evaluationMode: row.evaluationMode,
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
      updatedAt: this.toDate(row.updatedAt) ?? new Date(0),
    };
  }

  private mapBadgeRuleRow(row: typeof badgeRules.$inferSelect): BadgeRuleRow {
    return {
      ruleId: row.ruleId,
      badgeId: row.badgeId,
      ruleType: row.ruleType,
      priority: row.priority,
      config: row.config as Record<string, unknown>,
      isActive: row.isActive,
      createdAt: this.toDate(row.createdAt) ?? new Date(0),
    };
  }
}
