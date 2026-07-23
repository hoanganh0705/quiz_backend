/**
 * Achievement History Service
 *
 * Manages immutable achievement history records.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../infrastructure/repositories/achievement.repository';
import type {
  UserBadgeRow,
  BadgeDefinitionRow,
} from '../infrastructure/repositories/achievement.repository';

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

  async getUserHistory(
    userId: string,
    options: Partial<HistoryQueryOptions> = {},
  ): Promise<AchievementHistoryEntry[]> {
    const { data: userBadges } = await this.achievementRepository.getUserBadgesWithDetails(userId);

    const now = new Date();
    return userBadges
      .filter((ub) => {
        if (!options.includeRevoked && ub.revokedAt) {
          return false;
        }

        if (options.category && ub.badge.category !== options.category) {
          return false;
        }

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

  async getHistoryEntry(userBadgeId: string): Promise<AchievementHistoryEntry | null> {
    this.logger.debug({
      event: 'get_history_entry',
      userBadgeId,
    });

    const result = await this.achievementRepository.getUserBadgeById(userBadgeId);
    if (!result) return null;

    return this.toHistoryEntry(result, new Date());
  }

  async getUserHistorySummary(userId: string): Promise<HistorySummary> {
    const { data: userBadges } = await this.achievementRepository.getUserBadgesWithDetails(userId);
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
      if (badge.revokedAt) {
        summary.revokedBadges++;
      } else if (badge.expiresAt && badge.expiresAt < now) {
        summary.expiredBadges++;
      } else {
        summary.activeBadges++;
      }

      const category = badge.badge.category;
      summary.badgesByCategory[category] = (summary.badgesByCategory[category] || 0) + 1;

      const type = badge.badge.type;
      summary.badgesByType[type] = (summary.badgesByType[type] || 0) + 1;
    }

    return summary;
  }

  async getBadgeHistory(
    badgeId: string,
    options: Partial<HistoryQueryOptions> = {},
  ): Promise<AchievementHistoryEntry[]> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return [];

    const { data: badgeAwards, total } = await this.achievementRepository.getBadgeAwards(badgeId, {
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      includeRevoked: options.includeRevoked ?? false,
    });

    void total;

    const now = new Date();
    return badgeAwards
      .filter((award) => {
        if (!options.includeRevoked && award.revokedAt) {
          return false;
        }
        if (options.startDate && award.earnedAt < options.startDate) {
          return false;
        }
        if (options.endDate && award.earnedAt > options.endDate) {
          return false;
        }
        return true;
      })
      .map((award) => this.toHistoryEntry(award, now));
  }

  async getBadgeVersionHistory(badgeId: string): Promise<BadgeVersionHistory | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

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

  async wasBadgePreviouslyRevoked(userId: string, badgeId: string): Promise<boolean> {
    this.logger.debug({
      event: 'check_badge_revoked',
      userId,
      badgeId,
    });

    const { data: revokedBadges } = await this.achievementRepository.getRevokedUserBadges(
      userId,
      badgeId,
    );
    return revokedBadges.length > 0;
  }

  async getRecentAwards(limit: number = 20): Promise<AchievementHistoryEntry[]> {
    this.logger.debug({
      event: 'get_recent_awards',
      limit,
    });

    const recentAwards = await this.achievementRepository.getRecentAwards(limit);
    const now = new Date();

    const entries: AchievementHistoryEntry[] = [];
    for (const award of recentAwards) {
      const fullRecord = await this.achievementRepository.getUserBadgeById(award.badgeId);
      if (fullRecord) {
        entries.push(this.toHistoryEntry(fullRecord, now));
      }
    }

    return entries;
  }

  async getAwardsByCategory(
    category: string,
    limit: number = 50,
  ): Promise<AchievementHistoryEntry[]> {
    this.logger.debug({
      event: 'get_awards_by_category',
      category,
      limit,
    });

    const { data: awards } = await this.achievementRepository.getAwardsByCategory(category, {
      limit,
    });
    const now = new Date();

    return awards.map((award) => this.toHistoryEntry(award, now));
  }

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

  async calculateAchievementDensity(userId: string): Promise<number> {
    const summary = await this.getUserHistorySummary(userId);
    const history = await this.getUserHistory(userId);

    if (history.length === 0) return 0;

    const firstAward = history.reduce(
      (oldest, entry) => (entry.earnedAt < oldest ? entry.earnedAt : oldest),
      history[0].earnedAt,
    );
    const lastAward = history.reduce(
      (newest, entry) => (entry.earnedAt > newest ? entry.earnedAt : newest),
      history[0].earnedAt,
    );

    const daysActive =
      Math.ceil((lastAward.getTime() - firstAward.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return daysActive > 0 ? summary.totalBadges / daysActive : 0;
  }

  async getUserMilestones(userId: string): Promise<AchievementHistoryEntry[]> {
    const history = await this.getUserHistory(userId, { includeRevoked: false });

    const milestones = [0, 9, 24, 49, 99, 199, 499, 999];
    return milestones.filter((idx) => idx < history.length).map((idx) => history[idx]);
  }

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
