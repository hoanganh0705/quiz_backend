/**
 * Achievement Repository Port
 *
 * Defines the interface for achievement data access.
 */

import type { BadgeRuleType, badgeCategory } from '@/core/database/schema';

export type UserBadgeRow = {
  userBadgeId: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  badgeVersion: string;
  progress: Record<string, unknown>;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
};

export type BadgeDefinitionRow = {
  badgeId: string;
  slug: string;
  type: string;
  category: (typeof badgeCategory.enumValues)[number];
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
  isHidden: boolean;
  version: string;
  validFrom: Date | null;
  validUntil: Date | null;
  evaluationMode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BadgeRuleRow = {
  ruleId: string;
  badgeId: string;
  ruleType: (typeof BadgeRuleType.enumValues)[number];
  priority: number;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
};

export interface AchievementRepositoryPort {
  /**
   * Check if user already has a specific badge (active, not revoked).
   */
  hasBadge(userId: string, badgeId: string): Promise<boolean>;

  /**
   * Award a badge to a user.
   */
  awardBadge(params: {
    userId: string;
    badgeId: string;
    badgeVersion?: string;
    earnedAt?: Date;
    progress?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<UserBadgeRow>;

  /**
   * Get all active badges for a user.
   */
  getUserBadges(userId: string): Promise<UserBadgeRow[]>;

  /**
   * Get all active badges for a user, with badge details.
   */
  getUserBadgesWithDetails(userId: string): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow })[]>;

  /**
   * Get badge definition by ID.
   */
  getBadgeById(badgeId: string): Promise<BadgeDefinitionRow | null>;

  /**
   * Get badge definition by slug.
   */
  getBadgeBySlug(slug: string): Promise<BadgeDefinitionRow | null>;

  /**
   * Get all active badge definitions.
   */
  getAllActiveBadges(): Promise<BadgeDefinitionRow[]>;

  /**
   * Get badge rules for a specific badge.
   */
  getBadgeRules(badgeId: string): Promise<BadgeRuleRow[]>;

  /**
   * Get all active badge rules.
   */
  getAllActiveRules(): Promise<BadgeRuleRow[]>;

  /**
   * Get rules by type (for event-based evaluation).
   */
  getRulesByType(ruleType: (typeof BadgeRuleType.enumValues)[number]): Promise<BadgeRuleRow[]>;

  /**
   * Get badges by category.
   */
  getBadgesByCategory(
    category: (typeof badgeCategory.enumValues)[number],
  ): Promise<BadgeDefinitionRow[]>;

  /**
   * Update badge progress for a user.
   */
  updateBadgeProgress(
    userId: string,
    badgeId: string,
    progress: Record<string, unknown>,
  ): Promise<void>;

  /**
   * Get badge progress for a user.
   */
  getBadgeProgress(userId: string, badgeId: string): Promise<Record<string, unknown> | null>;

  /**
   * Revoke a badge (for error correction only).
   */
  revokeBadge(
    userId: string,
    badgeId: string,
    reason: string,
  ): Promise<void>;

  /**
   * Check if badge is currently valid (not expired, within validFrom/validUntil).
   */
  isBadgeValid(badge: BadgeDefinitionRow): boolean;

  /**
   * Get recently awarded badges for a user (for notifications).
   */
  getRecentUserBadges(userId: string, limit?: number): Promise<UserBadgeRow[]>;

  /**
   * Count total badges for a user.
   */
  countUserBadges(userId: string): Promise<number>;

  /**
   * Count badges by type for a user.
   */
  countUserBadgesByType(userId: string, type: string): Promise<number>;

  /**
   * Get badge earners count.
   */
  getBadgeEarnersCount(badgeId: string): Promise<number>;
}

export const ACHIEVEMENT_REPOSITORY_PORT: unique symbol = Symbol('ACHIEVEMENT_REPOSITORY_PORT');
