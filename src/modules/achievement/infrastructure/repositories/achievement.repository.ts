import type { badgeRuleType, badgeCategory, badgeType } from '@/core/database/schema';

export interface RevokedBadgeRecord {
  userBadgeId: string;
  userId: string;
  badgeId: string;
  badgeSlug: string;
  badgeName: string;
  revokedAt: Date;
  revocationReason: string;
}

export type BadgeCatalogRow = {
  badgeId: string;
  name: string;
  description: string | null;
  rarity: string;
  earnedCount: number;
};

export type FeaturedBadgeRow = {
  badgeId: string;
  badgeName: string;
  rarity: string;
};

export type PublicAchievementProfileRow = {
  userId: string;
  totalBadges: number;
  rareBadges: number;
  highestRank: number | null;
  featuredBadges: FeaturedBadgeRow[];
};

export type BadgeDetailsRow = {
  badgeId: string;
  name: string;
  description: string | null;
  rarity: string;
  earnedCount: number;
};

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
  type: (typeof badgeType.enumValues)[number];
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
  ruleType: (typeof badgeRuleType.enumValues)[number];
  priority: number;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
};

export interface AchievementRepositoryPort {
  hasBadge(userId: string, badgeId: string): Promise<boolean>;

  hasBadges(userId: string, badgeIds: string[]): Promise<Record<string, boolean>>;

  awardBadge(params: {
    userId: string;
    badgeId: string;
    badgeVersion?: string;
    earnedAt?: Date;
    progress?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<UserBadgeRow | null>;

  getUserBadges(userId: string): Promise<UserBadgeRow[]>;

  getUserBadgesWithDetails(
    userId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{
    data: (UserBadgeRow & { badge: BadgeDefinitionRow })[];
    total: number;
  }>;

  getBadgeCatalog(params?: { limit?: number; offset?: number; category?: string }): Promise<{
    data: BadgeCatalogRow[];
    total: number;
  }>;

  getPublicAchievementProfile(userId: string): Promise<PublicAchievementProfileRow | null>;

  getBadgeDetailsById(badgeId: string): Promise<BadgeDetailsRow | null>;

  getBadgeById(badgeId: string): Promise<BadgeDefinitionRow | null>;

  getBadgeBySlug(slug: string): Promise<BadgeDefinitionRow | null>;

  getBadgesByIds(badgeIds: string[]): Promise<BadgeDefinitionRow[]>;

  getAllActiveBadges(): Promise<BadgeDefinitionRow[]>;

  getBadgeRules(badgeId: string): Promise<BadgeRuleRow[]>;

  getAllActiveRules(): Promise<BadgeRuleRow[]>;

  getRulesByType(ruleType: (typeof badgeRuleType.enumValues)[number]): Promise<BadgeRuleRow[]>;

  getBadgesByCategory(
    category: (typeof badgeCategory.enumValues)[number],
  ): Promise<BadgeDefinitionRow[]>;

  updateBadgeProgress(
    userId: string,
    badgeId: string,
    progress: Record<string, unknown>,
  ): Promise<void>;

  getBadgeProgress(userId: string, badgeId: string): Promise<Record<string, unknown> | null>;

  getBadgeProgressBatch(
    userId: string,
    badgeIds: string[],
  ): Promise<Record<string, Record<string, unknown> | null>>;

  revokeBadge(userId: string, badgeId: string, reason: string): Promise<RevokedBadgeRecord | null>;

  restoreBadge(
    userId: string,
    badgeId: string,
    restoredBy: string,
  ): Promise<RevokedBadgeRecord | null>;

  isBadgeValid(badge: BadgeDefinitionRow): boolean;

  getRecentUserBadges(userId: string, limit?: number): Promise<UserBadgeRow[]>;

  countUserBadges(userId: string): Promise<number>;

  countUserBadgesByType(
    userId: string,
    type: (typeof badgeType.enumValues)[number],
  ): Promise<number>;

  getBadgeEarnersCount(badgeId: string): Promise<number>;

  getBadgeEarnersCounts(badgeIds: string[]): Promise<Record<string, number>>;

  getBadgeEarnersCountTimeline(badgeId: string): Promise<{
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  }>;

  getDistinctBadgeEarners(): Promise<string[]>;

  getUsersEligibleForStreakBadge(
    minStreakDays: number,
    excludeBadgeId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ userId: string; currentStreak: number }[]>;

  getUsersEligibleForRankBadge(
    maxRank: number,
    period: string,
    excludeBadgeId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ userId: string; currentRank: number }[]>;

  getUserBadgeById(
    userBadgeId: string,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow }) | null>;

  getRevokedUserBadges(
    userId?: string,
    badgeId?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }>;

  getRecentAwards(
    userId?: string,
    limit?: number,
  ): Promise<{ userId: string; badgeId: string; earnedAt: Date }[]>;

  getRecentAwardsWithDetails(
    limit?: number,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow })[]>;

  getAwardsByCategory(
    category: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }>;

  getBadgeAwards(
    badgeId: string,
    options?: { limit?: number; offset?: number; includeRevoked?: boolean },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }>;

  getBadgeTopEarners(
    badgeId: string,
    limit?: number,
  ): Promise<{ userId: string; earnedAt: Date }[]>;

  getAwardTrendData(
    badgeIds: string[],
    days: number,
  ): Promise<{ date: string; badgeId: string; count: number }[]>;
}

export const ACHIEVEMENT_REPOSITORY_PORT: unique symbol = Symbol('ACHIEVEMENT_REPOSITORY_PORT');
