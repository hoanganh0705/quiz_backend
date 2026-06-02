/**
 * Badge Versioning Service
 *
 * Handles semantic versioning for badge definitions:
 * - Tracks version changes to badge definitions
 * - Preserves historical accuracy for earned badges
 * - Manages version increments based on changes
 *
 * Semantic Versioning for Badges:
 * - MAJOR: Breaking changes (name, criteria, icon)
 * - MINOR: Non-breaking additions (description, metadata)
 * - PATCH: Cosmetic fixes (typos, URL changes)
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

export interface BadgeChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface VersionUpgradeResult {
  badgeId: string;
  oldVersion: string;
  newVersion: string;
  changes: BadgeChange[];
  requiresMajorBump: boolean;
}

export interface BadgeVersionSummary {
  badgeId: string;
  slug: string;
  currentVersion: string;
  totalVersions: number;
  latestChange: Date;
  previousEarnersCount: number;
  isLatestVersion: boolean;
}

@Injectable()
export class BadgeVersioningService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(BadgeVersioningService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Compare two semantic versions.
   */
  compareVersions(version1: string, version2: string): number {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  /**
   * Parse a semantic version string.
   */
  parseVersion(version: string): VersionInfo {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0] ?? '0', 10),
      minor: parseInt(parts[1] ?? '0', 10),
      patch: parseInt(parts[2] ?? '0', 10),
    };
  }

  /**
   * Increment a semantic version.
   */
  incrementVersion(
    version: string,
    type: 'major' | 'minor' | 'patch',
  ): string {
    const parsed = this.parseVersion(version);

    switch (type) {
      case 'major':
        return `${parsed.major + 1}.0.0`;
      case 'minor':
        return `${parsed.major}.${parsed.minor + 1}.0`;
      case 'patch':
        return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    }
  }

  /**
   * Check if a version change requires a major bump.
   */
  requiresMajorBump(changes: BadgeChange[]): boolean {
    const majorChangeFields = [
      'name',
      'description',
      'iconUrl',
      'criteria',
      'category',
      'type',
      'rules',
    ];

    return changes.some((change) => majorChangeFields.includes(change.field));
  }

  /**
   * Determine the type of version bump needed.
   */
  determineVersionBump(changes: BadgeChange[]): 'major' | 'minor' | 'patch' {
    if (this.requiresMajorBump(changes)) {
      return 'major';
    }

    // Minor bump for metadata changes
    const minorChangeFields = ['metadata', 'validFrom', 'validUntil', 'isHidden'];
    if (changes.some((change) => minorChangeFields.includes(change.field))) {
      return 'minor';
    }

    // Patch for everything else (cosmetic fixes)
    return 'patch';
  }

  /**
   * Validate badge changes and determine version upgrade.
   */
  async validateBadgeChanges(
    badgeId: string,
    updates: Partial<BadgeDefinitionRow>,
  ): Promise<VersionUpgradeResult | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      return null;
    }

    const changes: BadgeChange[] = [];

    // Check each field for changes
    if (updates.name !== undefined && updates.name !== badge.name) {
      changes.push({ field: 'name', oldValue: badge.name, newValue: updates.name });
    }

    if (updates.description !== undefined && updates.description !== badge.description) {
      changes.push({ field: 'description', oldValue: badge.description, newValue: updates.description });
    }

    if (updates.iconUrl !== undefined && updates.iconUrl !== badge.iconUrl) {
      changes.push({ field: 'iconUrl', oldValue: badge.iconUrl, newValue: updates.iconUrl });
    }

    if (updates.category !== undefined && updates.category !== badge.category) {
      changes.push({ field: 'category', oldValue: badge.category, newValue: updates.category });
    }

    if (updates.type !== undefined && updates.type !== badge.type) {
      changes.push({ field: 'type', oldValue: badge.type, newValue: updates.type });
    }

    if (updates.validFrom !== undefined && updates.validFrom !== badge.validFrom) {
      changes.push({ field: 'validFrom', oldValue: badge.validFrom, newValue: updates.validFrom });
    }

    if (updates.validUntil !== undefined && updates.validUntil !== badge.validUntil) {
      changes.push({ field: 'validUntil', oldValue: badge.validUntil, newValue: updates.validUntil });
    }

    if (updates.isHidden !== undefined && updates.isHidden !== badge.isHidden) {
      changes.push({ field: 'isHidden', oldValue: badge.isHidden, newValue: updates.isHidden });
    }

    if (changes.length === 0) {
      return null;
    }

    const bumpType = this.determineVersionBump(changes);
    const newVersion = this.incrementVersion(badge.version, bumpType);

    return {
      badgeId,
      oldVersion: badge.version,
      newVersion,
      changes,
      requiresMajorBump: bumpType === 'major',
    };
  }

  /**
   * Get all versions of a badge.
   */
  async getBadgeVersionHistory(badgeId: string): Promise<BadgeVersionSummary[]> {
    // In a real implementation, this would query a badge_versions table
    // For now, return the current version info
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return [];

    const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badgeId);

    return [{
      badgeId: badge.badgeId,
      slug: badge.slug,
      currentVersion: badge.version,
      totalVersions: 1,
      latestChange: badge.updatedAt,
      previousEarnersCount: earnerCount,
      isLatestVersion: true,
    }];
  }

  /**
   * Get badges that have newer versions available.
   */
  async getOutdatedBadges(): Promise<BadgeDefinitionRow[]> {
    // In a real implementation, this would query for badges where
    // there's a newer version available
    this.logger.debug({
      event: 'get_outdated_badges',
    });

    return [];
  }

  /**
   * Compare badges across versions for display.
   */
  async compareBadgeVersions(
    badgeId: string,
    version1: string,
    version2: string,
  ): Promise<BadgeChange[]> {
    // In a real implementation, this would compare the two versions
    this.logger.debug({
      event: 'compare_badge_versions',
      badgeId,
      version1,
      version2,
    });

    return [];
  }

  /**
   * Check if a badge version is the latest.
   */
  async isLatestVersion(badgeId: string, version: string): Promise<boolean> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return false;

    return badge.version === version;
  }

  /**
   * Get version summary for a user's badges.
   */
  async getUserBadgeVersionSummary(userId: string): Promise<{
    totalBadges: number;
    latestVersionCount: number;
    legacyBadgeCount: number;
    legacyBadges: { slug: string; earnedVersion: string; latestVersion: string }[];
  }> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);

    let latestVersionCount = 0;
    let legacyBadgeCount = 0;
    const legacyBadges: { slug: string; earnedVersion: string; latestVersion: string }[] = [];

    for (const userBadge of userBadges) {
      const isLatest = userBadge.badgeVersion === userBadge.badge.version;
      if (isLatest) {
        latestVersionCount++;
      } else {
        legacyBadgeCount++;
        legacyBadges.push({
          slug: userBadge.badge.slug,
          earnedVersion: userBadge.badgeVersion,
          latestVersion: userBadge.badge.version,
        });
      }
    }

    return {
      totalBadges: userBadges.length,
      latestVersionCount,
      legacyBadgeCount,
      legacyBadges,
    };
  }
}
