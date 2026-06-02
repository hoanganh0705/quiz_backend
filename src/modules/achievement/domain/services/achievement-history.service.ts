/**
 * Achievement History Service
 *
 * Manages immutable achievement history records.
 *
 * Design principles:
 * - Awarded badges are immutable records
 * - Revoked badges are marked but NOT deleted (audit trail)
 * - Badge versions are tracked for historical accuracy
 * - All state changes are logged
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { UserBadgeRow, BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

export interface AchievementHistoryEntry {
  userBadgeId: string;
  userId: string;
  badgeId: string;
  badgeSlug: string;
  badgeName: string;
  badgeType: string;
  badgeCategory: string;
  earnedAt: Date;
  badgeVersion: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
}

export interface HistoryQueryOptions {
  userId?: string;
  badgeId?: string;
  includeRevoked?: boolean;
  startDate?: Date;
  endDate?: Date;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface HistorySummary {
  totalBadges: number;
  activeBadges: number;
  revokedBadges: number;
  expiredBadges: number;
  badgesByCategory: Record<string, number>;
  badgesByType: Record<string, number>;
}

export interface BadgeVersionHistory {
  badgeId: string;
  slug: string;
  versions: BadgeVersionRecord[];
}

export interface BadgeVersionRecord {
  version: string;
  awardedAt: Date;
  revokedAt: Date | null;
  userId: string;
}

@Injectable()
export class AchievementHistoryService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(AchievementHistoryService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get full achievement history for a user.
   */
  async getUserHistory(
    userId: string,
    options: Partial<HistoryQueryOptions> = {},
  ): Promise<AchievementHistoryEntry[]> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);

    const now = new Date();
    return userBadges
      .filter((ub) => {
        // Filter by revoked status
        if (!options.includeRevoked && ub.revokedAt) {
          return false;
        }

        // Filter by category
        if (options.category && ub.badge.category !== options.category) {
          return false;
        }

        // Filter by date range
        if (options.startDate && ub.earnedAt < options.startDate) {
          return false;
        }
        if (options.endDate && ub.earnedAt > options.endDate) {
          return false;
        }

        return true;
      })
      .map((ub) => this.toHistoryEntry(ub, now));
  }

  /**
   * Get a specific history entry.
   */
  async getHistoryEntry(userBadgeId: string): Promise<AchievementHistoryEntry | null> {
    // This would require a method to get a single userBadge by ID
    // For now, return null - actual implementation would query by userBadgeId
    this.logger.debug({
      event: 'get_history_entry',
      userBadgeId,
    });
    return null;
  }

  /**
   * Get summary statistics for a user's achievement history.
   */
  async getUserHistorySummary(userId: string): Promise<HistorySummary> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);
    const now = new Date();

    const summary: HistorySummary = {
      totalBadges: userBadges.length,
      activeBadges: 0,
      revokedBadges: 0,
      expiredBadges: 0,
      badgesByCategory: {},
      badgesByType: {},
    };

    for (const badge of userBadges) {
      // Count by status
      if (badge.revokedAt) {
        summary.revokedBadges++;
      } else if (badge.expiresAt && badge.expiresAt < now) {
        summary.expiredBadges++;
      } else {
        summary.activeBadges++;
      }

      // Count by category
      const category = badge.badge.category;
      summary.badgesByCategory[category] = (summary.badgesByCategory[category] || 0) + 1;

      // Count by type
      const type = badge.badge.type;
      summary.badgesByType[type] = (summary.badgesByType[type] || 0) + 1;
    }

    return summary;
  }

  /**
   * Get history for a specific badge (all users who earned it).
   */
  async getBadgeHistory(
    badgeId: string,
    options: Partial<HistoryQueryOptions> = {},
  ): Promise<AchievementHistoryEntry[]> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return [];

    // Get all users who have earned this badge
    // This would require a method in the repository
    this.logger.debug({
      event: 'get_badge_history',
      badgeId,
    });

    return [];
  }

  /**
   * Get badge version history.
   * Shows when each version was awarded to which users.
   */
  async getBadgeVersionHistory(badgeId: string): Promise<BadgeVersionHistory | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    // In a real implementation, this would query all userBadges for this badge
    // and group them by version
    this.logger.debug({
      event: 'get_badge_version_history',
      badgeId,
    });

    return {
      badgeId,
      slug: badge.slug,
      versions: [],
    };
  }

  /**
   * Check if a badge was previously revoked for a user.
   */
  async wasBadgePreviouslyRevoked(userId: string, badgeId: string): Promise<boolean> {
    // This would query the userBadges table for revoked records
    // For now, return false - actual implementation would check
    this.logger.debug({
      event: 'check_badge_revoked',
      userId,
      badgeId,
    });
    return false;
  }

  /**
   * Get recently awarded badges across all users.
   * Useful for activity feeds and leaderboards.
   */
  async getRecentAwards(limit: number = 20): Promise<AchievementHistoryEntry[]> {
    // This would query the userBadges table ordered by earnedAt DESC
    this.logger.debug({
      event: 'get_recent_awards',
      limit,
    });

    return [];
  }

  /**
   * Get awards by category.
   */
  async getAwardsByCategory(
    category: string,
    limit: number = 50,
  ): Promise<AchievementHistoryEntry[]> {
    // This would query and filter by category
    this.logger.debug({
      event: 'get_awards_by_category',
      category,
      limit,
    });

    return [];
  }

  /**
   * Get award timeline for a user.
   * Groups awards by day for display purposes.
   */
  async getUserAwardTimeline(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<string, AchievementHistoryEntry[]>> {
    const history = await this.getUserHistory(userId, {
      startDate,
      endDate,
    });

    const timeline = new Map<string, AchievementHistoryEntry[]>();

    for (const entry of history) {
      const dateKey = entry.earnedAt.toISOString().split('T')[0];
      const existing = timeline.get(dateKey) ?? [];
      existing.push(entry);
      timeline.set(dateKey, existing);
    }

    return timeline;
  }

  /**
   * Calculate achievement density (badges per day of activity).
   */
  async calculateAchievementDensity(userId: string): Promise<number> {
    const summary = await this.getUserHistorySummary(userId);
    const history = await this.getUserHistory(userId);

    if (history.length === 0) return 0;

    // Get date range
    const firstAward = history.reduce((oldest, entry) =>
      entry.earnedAt < oldest ? entry.earnedAt : oldest,
    );
    const lastAward = history.reduce((newest, entry) =>
      entry.earnedAt > newest ? entry.earnedAt : newest,
    );

    const daysActive = Math.ceil(
      (lastAward.getTime() - firstAward.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;

    return daysActive > 0 ? summary.totalBadges / daysActive : 0;
  }

  /**
   * Get milestone achievements (first badge, 10th badge, etc.).
   */
  async getUserMilestones(userId: string): Promise<AchievementHistoryEntry[]> {
    const history = await this.getUserHistory(userId, { includeRevoked: false });

    // Return badges at milestone positions
    const milestones = [0, 9, 24, 49, 99, 199, 499, 999];
    return milestones
      .filter((idx) => idx < history.length)
      .map((idx) => history[idx]);
  }

  /**
   * Export user achievement history for data portability.
   */
  async exportUserHistory(userId: string): Promise<Record<string, unknown>> {
    const history = await this.getUserHistory(userId);
    const summary = await this.getUserHistorySummary(userId);

    return {
      userId,
      exportedAt: new Date().toISOString(),
      summary,
      achievements: history.map((entry) => ({
        badge: entry.badgeSlug,
        name: entry.badgeName,
        earnedAt: entry.earnedAt.toISOString(),
        version: entry.badgeVersion,
        active: entry.isActive,
        revoked: entry.revokedAt !== null,
        revokedAt: entry.revokedAt?.toISOString() ?? null,
        reason: entry.revocationReason,
      })),
    };
  }

  /**
   * Convert a userBadge row to a history entry.
   */
  private toHistoryEntry(
    row: UserBadgeRow & { badge: BadgeDefinitionRow },
    now: Date,
  ): AchievementHistoryEntry {
    return {
      userBadgeId: row.userBadgeId,
      userId: row.userId,
      badgeId: row.badgeId,
      badgeSlug: row.badge.slug,
      badgeName: row.badge.name,
      badgeType: row.badge.type,
      badgeCategory: row.badge.category,
      earnedAt: row.earnedAt,
      badgeVersion: row.badgeVersion,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      revocationReason: row.revocationReason,
      metadata: row.metadata,
      isActive: !row.revokedAt && (!row.expiresAt || row.expiresAt > now),
    };
  }
}
