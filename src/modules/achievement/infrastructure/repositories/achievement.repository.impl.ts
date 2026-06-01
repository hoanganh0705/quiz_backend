/**
 * Achievement Repository Implementation
 *
 * Database-backed implementation using Drizzle ORM.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, eq, desc, isNull, sql, count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@/core/database/schema';
import {
  badges,
  badgeRules,
  userBadges,
  type badgeCategory,
} from '@/core/database/schema';
import type { BadgeRuleType } from '@/core/database/schema';
import type { AchievementRepositoryPort } from './achievement.repository';
import type {
  UserBadgeRow,
  BadgeDefinitionRow,
  BadgeRuleRow,
} from './achievement.repository';

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
    const now = params.earnedAt ?? new Date();

    const result = await this.db
      .insert(userBadges)
      .values({
        userId: params.userId,
        badgeId: params.badgeId,
        badgeVersion: params.badgeVersion ?? '1.0.0',
        earnedAt: now,
        progress: params.progress ?? {},
        metadata: params.metadata ?? {},
        expiresAt: params.expiresAt ?? null,
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

    return {
      userBadgeId: row.user_badge_id,
      userId: row.user_id,
      badgeId: row.badge_id,
      earnedAt: row.earned_at,
      badgeVersion: row.badge_version,
      progress: row.progress as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
    };
  }

  async getUserBadges(userId: string): Promise<UserBadgeRow[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(desc(userBadges.earnedAt));

    return results.map((row) => ({
      userBadgeId: row.user_badge_id,
      userId: row.user_id,
      badgeId: row.badge_id,
      earnedAt: row.earned_at,
      badgeVersion: row.badge_version,
      progress: row.progress as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
    }));
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
      userBadgeId: row.user_badges.user_badge_id,
      userId: row.user_badges.user_id,
      badgeId: row.user_badges.badge_id,
      earnedAt: row.user_badges.earned_at,
      badgeVersion: row.user_badges.badge_version,
      progress: row.user_badges.progress as Record<string, unknown>,
      metadata: row.user_badges.metadata as Record<string, unknown>,
      expiresAt: row.user_badges.expires_at,
      revokedAt: row.user_badges.revoked_at,
      revocationReason: row.user_badges.revocation_reason,
      badge: {
        badgeId: row.badges.badge_id,
        slug: row.badges.slug,
        type: row.badges.type,
        category: row.badges.category as (typeof badgeCategory.enumValues)[number],
        name: row.badges.name,
        description: row.badges.description,
        iconUrl: row.badges.icon_url,
        isActive: row.badges.is_active,
        isHidden: row.badges.is_hidden,
        version: row.badges.version,
        validFrom: row.badges.valid_from,
        validUntil: row.badges.valid_until,
        evaluationMode: row.badges.evaluation_mode,
        createdAt: row.badges.created_at,
        updatedAt: row.badges.updated_at,
      },
    }));
  }

  async getBadgeById(badgeId: string): Promise<BadgeDefinitionRow | null> {
    const results = await this.db
      .select()
      .from(badges)
      .where(eq(badges.badgeId, badgeId))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      badgeId: row.badge_id,
      slug: row.slug,
      type: row.type,
      category: row.category as (typeof badgeCategory.enumValues)[number],
      name: row.name,
      description: row.description,
      iconUrl: row.icon_url,
      isActive: row.is_active,
      isHidden: row.is_hidden,
      version: row.version,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      evaluationMode: row.evaluation_mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getBadgeBySlug(slug: string): Promise<BadgeDefinitionRow | null> {
    const results = await this.db
      .select()
      .from(badges)
      .where(eq(badges.slug, slug))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      badgeId: row.badge_id,
      slug: row.slug,
      type: row.type,
      category: row.category as (typeof badgeCategory.enumValues)[number],
      name: row.name,
      description: row.description,
      iconUrl: row.icon_url,
      isActive: row.is_active,
      isHidden: row.is_hidden,
      version: row.version,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      evaluationMode: row.evaluation_mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllActiveBadges(): Promise<BadgeDefinitionRow[]> {
    const now = new Date();
    const results = await this.db
      .select()
      .from(badges)
      .where(eq(badges.isActive, true));

    return results
      .filter((row) => this.isBadgeValid(row))
      .map((row) => ({
        badgeId: row.badge_id,
        slug: row.slug,
        type: row.type,
        category: row.category as (typeof badgeCategory.enumValues)[number],
        name: row.name,
        description: row.description,
        iconUrl: row.icon_url,
        isActive: row.is_active,
        isHidden: row.is_hidden,
        version: row.version,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        evaluationMode: row.evaluation_mode,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  async getBadgeRules(badgeId: string): Promise<BadgeRuleRow[]> {
    const results = await this.db
      .select()
      .from(badgeRules)
      .where(and(eq(badgeRules.badgeId, badgeId), eq(badgeRules.isActive, true)))
      .orderBy(desc(badgeRules.priority));

    return results.map((row) => ({
      ruleId: row.rule_id,
      badgeId: row.badge_id,
      ruleType: row.rule_type as (typeof BadgeRuleType.enumValues)[number],
      priority: row.priority,
      config: row.config as Record<string, unknown>,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));
  }

  async getAllActiveRules(): Promise<BadgeRuleRow[]> {
    const results = await this.db
      .select()
      .from(badgeRules)
      .innerJoin(badges, eq(badgeRules.badgeId, badges.badgeId))
      .where(and(eq(badgeRules.isActive, true), eq(badges.isActive, true)))
      .orderBy(desc(badgeRules.priority));

    return results.map((row) => ({
      ruleId: row.badge_rules.rule_id,
      badgeId: row.badge_rules.badge_id,
      ruleType: row.badge_rules.rule_type as (typeof BadgeRuleType.enumValues)[number],
      priority: row.badge_rules.priority,
      config: row.badge_rules.config as Record<string, unknown>,
      isActive: row.badge_rules.is_active,
      createdAt: row.badge_rules.created_at,
    }));
  }

  async getRulesByType(
    ruleType: (typeof BadgeRuleType.enumValues)[number],
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

    return results.map((row) => ({
      ruleId: row.badge_rules.rule_id,
      badgeId: row.badge_rules.badge_id,
      ruleType: row.badge_rules.rule_type as (typeof BadgeRuleType.enumValues)[number],
      priority: row.badge_rules.priority,
      config: row.badge_rules.config as Record<string, unknown>,
      isActive: row.badge_rules.is_active,
      createdAt: row.badge_rules.created_at,
    }));
  }

  async getBadgesByCategory(
    category: (typeof badgeCategory.enumValues)[number],
  ): Promise<BadgeDefinitionRow[]> {
    const results = await this.db
      .select()
      .from(badges)
      .where(and(eq(badges.category, category), eq(badges.isActive, true)));

    return results
      .filter((row) => this.isBadgeValid(row))
      .map((row) => ({
        badgeId: row.badge_id,
        slug: row.slug,
        type: row.type,
        category: row.category as (typeof badgeCategory.enumValues)[number],
        name: row.name,
        description: row.description,
        iconUrl: row.icon_url,
        isActive: row.is_active,
        isHidden: row.is_hidden,
        version: row.version,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        evaluationMode: row.evaluation_mode,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
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

  async getBadgeProgress(
    userId: string,
    badgeId: string,
  ): Promise<Record<string, unknown> | null> {
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
        revokedAt: new Date(),
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
    validFrom: Date | null;
    validUntil: Date | null;
  }): boolean {
    const now = new Date();
    if (badge.validFrom && now < badge.validFrom) return false;
    if (badge.validUntil && now > badge.validUntil) return false;
    return true;
  }

  async getRecentUserBadges(userId: string, limit = 5): Promise<UserBadgeRow[]> {
    const results = await this.db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)))
      .orderBy(desc(userBadges.earnedAt))
      .limit(limit);

    return results.map((row) => ({
      userBadgeId: row.user_badge_id,
      userId: row.user_id,
      badgeId: row.badge_id,
      earnedAt: row.earned_at,
      badgeVersion: row.badge_version,
      progress: row.progress as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
    }));
  }

  async countUserBadges(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), isNull(userBadges.revokedAt)));

    return result[0]?.count ?? 0;
  }

  async countUserBadgesByType(userId: string, type: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.badgeId))
      .where(and(eq(userBadges.userId, userId), eq(badges.type, type), isNull(userBadges.revokedAt)));

    return result[0]?.count ?? 0;
  }

  async getBadgeEarnersCount(badgeId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userBadges)
      .where(and(eq(userBadges.badgeId, badgeId), isNull(userBadges.revokedAt)));

    return result[0]?.count ?? 0;
  }
}
