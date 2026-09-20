import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, desc, inArray, count, sql, asc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import { badges, badgeRules, userBadges } from '@/core/database/schema';
import type {
  BadgeCatalogRow,
  BadgeDetailsRow,
  BadgeDefinitionRow,
  BadgeRuleRow,
} from '../achievement.repository';
import {
  RARITY_THRESHOLDS,
  computeRarityString,
} from '../../../domain/constants/achievement.constants';
import type { badgeCategory, badgeRuleType } from '@/core/database/schema';

@Injectable()
export class AchievementDefinitionRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectPinoLogger(AchievementDefinitionRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async getBadgeCatalog(params?: {
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<{ data: BadgeCatalogRow[]; total: number }> {
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
        and(eq(userBadges.badgeId, badges.badgeId), sql`${userBadges.revokedAt} IS NULL`),
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
        rarity: computeRarityString(row.earnedCount),
        earnedCount: row.earnedCount,
      })),
      total: countResult[0]?.count ?? 0,
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
        and(eq(userBadges.badgeId, badges.badgeId), sql`${userBadges.revokedAt} IS NULL`),
      )
      .where(eq(badges.badgeId, badgeId))
      .groupBy(badges.badgeId, badges.name, badges.description)
      .limit(1);

    const row = results[0];
    if (!row) {
      return null;
    }

    return {
      badgeId: row.badgeId,
      name: row.name,
      description: row.description,
      rarity: computeRarityString(row.earnedCount),
      earnedCount: row.earnedCount,
    };
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

  private toDate(value: string | Date | null): Date | null {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
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
