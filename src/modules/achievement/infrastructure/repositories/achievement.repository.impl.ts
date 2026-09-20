import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AchievementDefinitionRepository } from './aggregates/achievement-definition.repository';
import { UserAchievementRepository } from './aggregates/user-achievement.repository';
import { AchievementLeaderboardRepository } from './aggregates/achievement-leaderboard.repository';

import type { AchievementRepositoryPort } from './achievement.repository';
import type {
  BadgeCatalogRow,
  BadgeDetailsRow,
  UserBadgeRow,
  BadgeDefinitionRow,
  RevokedBadgeRecord,
  PublicAchievementProfileRow,
  BadgeRuleRow,
} from './achievement.repository';
import type { badgeRuleType, badgeCategory, badgeType } from '@/core/database/schema';

@Injectable()
export class AchievementRepository implements AchievementRepositoryPort {
  constructor(
    private readonly definition: AchievementDefinitionRepository,
    private readonly userAchievement: UserAchievementRepository,
    private readonly leaderboard: AchievementLeaderboardRepository,
    @InjectPinoLogger(AchievementRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  // ─── Badge ownership / existence ─────────────────────────────────────────────

  hasBadge(userId: string, badgeId: string): Promise<boolean> {
    return this.userAchievement.hasBadge(userId, badgeId);
  }

  hasBadges(userId: string, badgeIds: string[]): Promise<Record<string, boolean>> {
    return this.userAchievement.hasBadges(userId, badgeIds);
  }

  // ─── Award / revoke ──────────────────────────────────────────────────────────

  awardBadge(params: {
    userId: string;
    badgeId: string;
    badgeVersion?: string;
    earnedAt?: Date;
    progress?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<UserBadgeRow | null> {
    return this.userAchievement.awardBadge(params);
  }

  revokeBadge(userId: string, badgeId: string, reason: string): Promise<RevokedBadgeRecord | null> {
    return this.userAchievement.revokeBadge(userId, badgeId, reason);
  }

  restoreBadge(
    userId: string,
    badgeId: string,
    restoredBy: string,
  ): Promise<RevokedBadgeRecord | null> {
    return this.userAchievement.restoreBadge(userId, badgeId, restoredBy);
  }

  // ─── User badge queries ──────────────────────────────────────────────────────

  getUserBadges(userId: string): Promise<UserBadgeRow[]> {
    return this.userAchievement.getUserBadges(userId);
  }

  getUserBadgesWithDetails(
    userId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    return this.userAchievement.getUserBadgesWithDetails(userId, params);
  }

  getRecentUserBadges(userId: string, limit = 5): Promise<UserBadgeRow[]> {
    return this.userAchievement.getRecentUserBadges(userId, limit);
  }

  countUserBadges(userId: string): Promise<number> {
    return this.userAchievement.countUserBadges(userId);
  }

  countUserBadgesByType(
    userId: string,
    type: (typeof badgeType.enumValues)[number],
  ): Promise<number> {
    return this.userAchievement.countUserBadgesByType(userId, type);
  }

  getUserBadgeById(
    userBadgeId: string,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow }) | null> {
    return this.userAchievement.getUserBadgeById(userBadgeId);
  }

  getRevokedUserBadges(
    userId?: string,
    badgeId?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    return this.userAchievement.getRevokedUserBadges(userId, badgeId, options);
  }

  // ─── Progress ────────────────────────────────────────────────────────────────

  updateBadgeProgress(
    userId: string,
    badgeId: string,
    progress: Record<string, unknown>,
  ): Promise<void> {
    return this.userAchievement.updateBadgeProgress(userId, badgeId, progress);
  }

  getBadgeProgress(userId: string, badgeId: string): Promise<Record<string, unknown> | null> {
    return this.userAchievement.getBadgeProgress(userId, badgeId);
  }

  getBadgeProgressBatch(
    userId: string,
    badgeIds: string[],
  ): Promise<Record<string, Record<string, unknown> | null>> {
    return this.userAchievement.getBadgeProgressBatch(userId, badgeIds);
  }

  // ─── Badge definition queries ────────────────────────────────────────────────

  getBadgeCatalog(params?: {
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<{ data: BadgeCatalogRow[]; total: number }> {
    return this.definition.getBadgeCatalog(params);
  }

  getBadgeDetailsById(badgeId: string): Promise<BadgeDetailsRow | null> {
    return this.definition.getBadgeDetailsById(badgeId);
  }

  getBadgeById(badgeId: string): Promise<BadgeDefinitionRow | null> {
    return this.definition.getBadgeById(badgeId);
  }

  getBadgeBySlug(slug: string): Promise<BadgeDefinitionRow | null> {
    return this.definition.getBadgeBySlug(slug);
  }

  getBadgesByIds(badgeIds: string[]): Promise<BadgeDefinitionRow[]> {
    return this.definition.getBadgesByIds(badgeIds);
  }

  getAllActiveBadges(): Promise<BadgeDefinitionRow[]> {
    return this.definition.getAllActiveBadges();
  }

  getBadgesByCategory(
    category: (typeof badgeCategory.enumValues)[number],
  ): Promise<BadgeDefinitionRow[]> {
    return this.definition.getBadgesByCategory(category);
  }

  // ─── Rules ──────────────────────────────────────────────────────────────────

  getBadgeRules(badgeId: string): Promise<BadgeRuleRow[]> {
    return this.definition.getBadgeRules(badgeId);
  }

  getAllActiveRules(): Promise<BadgeRuleRow[]> {
    return this.definition.getAllActiveRules();
  }

  getRulesByType(ruleType: (typeof badgeRuleType.enumValues)[number]): Promise<BadgeRuleRow[]> {
    return this.definition.getRulesByType(ruleType);
  }

  // ─── Validity ───────────────────────────────────────────────────────────────

  isBadgeValid(badge: BadgeDefinitionRow): boolean {
    return this.definition.isBadgeValid(badge);
  }

  // ─── Leaderboard / profile ──────────────────────────────────────────────────

  getPublicAchievementProfile(userId: string): Promise<PublicAchievementProfileRow | null> {
    return this.leaderboard.getPublicAchievementProfile(userId);
  }

  getUsersEligibleForStreakBadge(
    minStreakDays: number,
    excludeBadgeId: string,
    limit = 1000,
    offset = 0,
  ): Promise<{ userId: string; currentStreak: number }[]> {
    return this.leaderboard.getUsersEligibleForStreakBadge(
      minStreakDays,
      excludeBadgeId,
      limit,
      offset,
    );
  }

  getUsersEligibleForRankBadge(
    maxRank: number,
    period: string,
    excludeBadgeId: string,
    limit = 1000,
    offset = 0,
  ): Promise<{ userId: string; currentRank: number }[]> {
    return this.leaderboard.getUsersEligibleForRankBadge(
      maxRank,
      period,
      excludeBadgeId,
      limit,
      offset,
    );
  }

  // ─── Analytics / counts ─────────────────────────────────────────────────────

  getBadgeEarnersCount(badgeId: string): Promise<number> {
    return this.userAchievement.getBadgeEarnersCount(badgeId);
  }

  getBadgeEarnersCounts(badgeIds: string[]): Promise<Record<string, number>> {
    return this.userAchievement.getBadgeEarnersCounts(badgeIds);
  }

  getBadgeEarnersCountTimeline(badgeId: string): Promise<{
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  }> {
    return this.userAchievement.getBadgeEarnersCountTimeline(badgeId);
  }

  getDistinctBadgeEarners(): Promise<string[]> {
    return this.userAchievement.getDistinctBadgeEarners();
  }

  // ─── Award feed / trend ─────────────────────────────────────────────────────

  getRecentAwards(
    userId?: string,
    limit = 20,
  ): Promise<{ userId: string; badgeId: string; earnedAt: Date }[]> {
    return this.userAchievement.getRecentAwards(userId, limit);
  }

  getRecentAwardsWithDetails(
    limit?: number,
  ): Promise<(UserBadgeRow & { badge: BadgeDefinitionRow })[]> {
    return this.userAchievement.getRecentAwardsWithDetails(limit);
  }

  getAwardsByCategory(
    category: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    return this.userAchievement.getAwardsByCategory(category, options);
  }

  getBadgeAwards(
    badgeId: string,
    options?: { limit?: number; offset?: number; includeRevoked?: boolean },
  ): Promise<{ data: (UserBadgeRow & { badge: BadgeDefinitionRow })[]; total: number }> {
    return this.userAchievement.getBadgeAwards(badgeId, options);
  }

  getBadgeTopEarners(badgeId: string, limit = 10): Promise<{ userId: string; earnedAt: Date }[]> {
    return this.userAchievement.getBadgeTopEarners(badgeId, limit);
  }

  getAwardTrendData(
    badgeIds: string[],
    days: number,
  ): Promise<{ date: string; badgeId: string; count: number }[]> {
    return this.userAchievement.getAwardTrendData(badgeIds, days);
  }
}
