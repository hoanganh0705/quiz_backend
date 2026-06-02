/**
 * Achievement Repository Implementation
 *
 * Database-backed implementation using Drizzle ORM.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, desc, isNull, count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import {
  badges,
  badgeRules,
  userBadges,
  badgeType,
  badgeCategory,
  badgeRuleType,
} from '@/core/database/schema';
import type { AchievementRepositoryPort } from './achievement.repository';
import type { UserBadgeRow, BadgeDefinitionRow, BadgeRuleRow } from './achievement.repository';

@Injectable()
export class AchievementRepository implements AchievementRepositoryPort {
  constructor(
    @Inject('DATABASE')
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

  async awardBadge(params: {
    userId: string;
    badgeId: string;
    badgeVersion?: string;
    earnedAt?: Date;
    progress?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<UserBadgeRow> {
    const earnedAt = (params.earnedAt ?? new Date()).toISOString();
    const expiresAt = params.expiresAt ? params.expiresAt.toISOString() : null;

    const result = await this.db
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

    const row = result[0];
    if (!row) {
      throw new Error(`Failed to award badge ${params.badgeId} to user ${params.userId}`);
    }

    this.logger.info({
      event: 'badge_awarded',
      userId: params.userId,
      badgeId: params.badgeId,
    });

    return this.mapUserBadgeRow(row);
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
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow })[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(desc(userBadges.earnedAt));

    return results.map((row) => ({
      ...this.mapUserBadgeRow(row.user_badges),
      badge: this.mapBadgeRow(row.badges),
    }));
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

  async revokeBadge(userId: string, badgeId: string, reason: string): Promise<void> {
    await this.db
      .update(userBadges)
      .set({
        revokedAt: new Date().toISOString(),
        revocationReason: reason,
      })
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId),
          isNull(userBadges.revokedAt),
        ),
      )
      .execute();

    this.logger.warn({
      event: 'badge_revoked',
      userId,
      badgeId,
      reason,
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
