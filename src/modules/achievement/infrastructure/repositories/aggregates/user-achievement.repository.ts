import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, desc, isNull, count, inArray, gt, sql } from 'drizzle-orm';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import { badges, userBadges, outboxEvents } from '@/core/database/schema';
import type {
  RevokedBadgeRecord,
  UserBadgeRow,
  BadgeDefinitionRow,
} from '../achievement.repository';
import type { badgeType, badgeCategory } from '@/core/database/schema';

@Injectable()
export class UserAchievementRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectPinoLogger(UserAchievementRepository.name)
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
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
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
          eventType: 'badge.revoked',
          payload: {
            userId,
            badgeId,
            badgeSlug: badgeRow?.badgeSlug ?? '',
            revokedAt: nowIso,
            reason,
          },
          createdAt: nowIso,
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

  async restoreBadge(
    userId: string,
    badgeId: string,
    restoredBy: string,
  ): Promise<RevokedBadgeRecord | null> {
    const nowIso = new Date().toISOString();

    return this.db.transaction(async (tx) => {
      const results = await tx
        .update(userBadges)
        .set({
          revokedAt: null,
          revocationReason: null,
        })
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId),
            sql`${userBadges.revokedAt} IS NOT NULL`,
          ),
        )
        .returning();

      const restoredRow = results[0];
      if (!restoredRow) {
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
          eventType: 'badge.restored',
          payload: {
            userId,
            badgeId,
            badgeSlug: badgeRow?.badgeSlug ?? '',
            restoredAt: nowIso,
            restoredBy,
          },
          createdAt: nowIso,
          idempotencyKey: `achievement:restored:${userId}:${badgeId}:${nowIso}`,
        })
        .onConflictDoNothing({
          target: outboxEvents.idempotencyKey,
          where: sql`processed_at IS NULL AND idempotency_key IS NOT NULL`,
        });

      this.logger.info({
        event: 'badge_restored',
        userId,
        badgeId,
        restoredBy,
      });

      return {
        userBadgeId: restoredRow.userBadgeId,
        userId: restoredRow.userId,
        badgeId: restoredRow.badgeId,
        badgeSlug: badgeRow?.badgeSlug ?? '',
        badgeName: badgeRow?.badgeName ?? '',
        revokedAt: this.toDate(restoredRow.revokedAt) ?? new Date(0),
        revocationReason: restoredRow.revocationReason ?? '',
      };
    });
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
    userId?: string,
    limit = 20,
  ): Promise<{ userId: string; badgeId: string; earnedAt: Date }[]> {
    const conditions = [isNull(userBadges.revokedAt)];
    if (userId) {
      conditions.push(eq(userBadges.userId, userId));
    }

    const results = await this.db
      .select({
        userId: userBadges.userId,
        badgeId: userBadges.badgeId,
        earnedAt: userBadges.earnedAt,
      })
      .from(userBadges)
      .where(and(...conditions))
      .orderBy(desc(userBadges.earnedAt))
      .limit(limit)
      .execute();

    return results.map((row) => ({
      userId: row.userId,
      badgeId: row.badgeId,
      earnedAt: this.toDate(row.earnedAt) ?? new Date(),
    }));
  }

  async getRecentAwardsWithDetails(
    limit = 20,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow })[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(isNull(userBadges.revokedAt))
      .orderBy(desc(userBadges.earnedAt))
      .limit(limit)
      .execute();

    return results.map((row) => ({
      ...this.mapUserBadgeRow(row.user_badges),
      badge: this.mapBadgeRow(row.badges),
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
      .orderBy(sql`${userBadges.earnedAt} ASC`)
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
}
