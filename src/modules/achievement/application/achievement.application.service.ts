/**
 * Achievement Application Service
 *
 * Orchestrates achievement-related use cases and serves as the primary
 * entry point for the achievement feature.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeRevocationService } from '../domain/services';
import { ProgressTrackingService } from './progress-tracking.service';
import { AchievementHistoryService } from './achievement-history.service';
import { BadgeAnalyticsService } from './analytics/badge-analytics.service';
import { UserDomainService } from '@/modules/user/domain/user.service';
import {
  ACHIEVEMENT_REPOSITORY_PORT,
  type AchievementRepositoryPort,
  type BadgeCatalogRow,
  type BadgeDetailsRow,
  type FeaturedBadgeRow,
} from '../infrastructure/repositories/achievement.repository';
import {
  AchievementUserNotFoundError,
  BadgeNotFoundError,
  UserBadgeOwnershipNotFoundError,
} from '../domain/errors';
import { computeRarityString } from '../domain/constants/achievement.constants';
import { ScheduledEvaluationService } from '../infrastructure/scheduled/scheduled-evaluation.service';
import type { BadgeDetailsResponseDto } from '../dto/response/badge-details-response.dto';
import type { BadgeProgressResponseDto } from '../dto/response/badge-progress-response.dto';
import type { AchievementHistoryItemResponseDto } from '../dto/response/achievement-history-item-response.dto';
import type { UserBadgeAnalyticsResponseDto } from '../dto/response/user-badge-analytics-response.dto';
import type { BadgeCatalogItemResponseDto } from '../dto/response/badge-catalog-item-response.dto';
import type { MyBadgeItemDto } from '../dto/response/my-badges-response.dto';
import type {
  PublicAchievementProfileResponseDto,
  FeaturedBadgeResponseDto,
} from '../dto/response/public-achievement-profile-response.dto';
import type {
  AdminAchievementHistoryItemDto,
  ReevaluateUserResponseDto,
} from '../dto/response/achievement-admin-response.dto';
import type { BadgeProgressSnapshot } from './progress-tracking.service';
import { AuditLogService } from '@/common/audit/audit-log.service';

@Injectable()
export class AchievementApplicationService {
  constructor(
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly achievementHistoryService: AchievementHistoryService,
    private readonly badgeAnalyticsService: BadgeAnalyticsService,
    private readonly badgeRevocationService: BadgeRevocationService,
    private readonly userDomainService: UserDomainService,
    private readonly scheduledEvaluationService: ScheduledEvaluationService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    private readonly auditLogService: AuditLogService,
    @InjectPinoLogger(AchievementApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getBadgeCatalog(params?: { limit?: number; offset?: number }): Promise<{
    items: BadgeCatalogItemResponseDto[];
    total: number;
    limit?: number;
    offset?: number;
  }> {
    const { data: badges, total } = await this.achievementRepository.getBadgeCatalog(params);

    return {
      items: badges.map((badge) => this.toBadgeCatalogItemResponse(badge)),
      total,
      limit: params?.limit,
      offset: params?.offset,
    };
  }

  async getBadgeDetails(badgeId: string): Promise<BadgeDetailsResponseDto> {
    const badgeDetails = await this.achievementRepository.getBadgeDetailsById(badgeId);

    if (!badgeDetails) {
      this.logger.debug({ event: 'achievement_badge_not_found', badgeId });
      throw new BadgeNotFoundError(badgeId);
    }

    return this.toBadgeDetailsResponse(badgeDetails);
  }

  async getMyBadgeProgress(userId: string, badgeId: string): Promise<BadgeProgressResponseDto> {
    const progressSnapshot = await this.progressTrackingService.getBadgeProgressSnapshot(
      userId,
      badgeId,
    );

    if (!progressSnapshot) {
      this.logger.debug({ event: 'achievement_badge_progress_not_found', userId, badgeId });
      throw new BadgeNotFoundError(badgeId);
    }

    return this.toBadgeProgressResponse(badgeId, progressSnapshot);
  }

  async getMyAchievementHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{
    items: AchievementHistoryItemResponseDto[];
    total: number;
    limit?: number;
    offset?: number;
  }> {
    const { entries, total } = await this.achievementHistoryService.getUserHistory(userId, {
      includeRevoked: false,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    });

    return {
      items: entries.map((entry) => ({
        badgeId: entry.badgeId,
        badgeName: entry.badgeName,
        earnedAt: entry.earnedAt.toISOString(),
      })),
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  }

  async getMyBadgeAnalytics(userId: string): Promise<UserBadgeAnalyticsResponseDto> {
    const analytics = await this.badgeAnalyticsService.getUserBadgeAnalyticsSnapshot(userId);

    return {
      totalBadges: analytics.totalBadges,
      rareBadges: analytics.rareBadges,
      completionRate: analytics.completionRate,
      latestBadgeEarnedAt: analytics.latestBadgeEarnedAt?.toISOString() ?? null,
    };
  }

  async getMyBadges(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: MyBadgeItemDto[]; total: number; limit?: number; offset?: number }> {
    const { data: userBadges, total } = await this.achievementRepository.getUserBadgesWithDetails(
      userId,
      options,
    );

    const badgeIds = userBadges.map((ub) => ub.badgeId);
    const earnerCounts =
      badgeIds.length > 0 ? await this.achievementRepository.getBadgeEarnersCounts(badgeIds) : {};

    return {
      items: userBadges.map((ub) => ({
        badgeId: ub.badgeId,
        name: ub.badge.name,
        description: ub.badge.description,
        rarity: computeRarityString(earnerCounts[ub.badgeId] ?? 0),
        earnedAt: ub.earnedAt.toISOString(),
      })),
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  }

  async revokeUserBadge(userId: string, badgeId: string, revokedBy: string): Promise<void> {
    await this.assertUserExists(userId);

    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      this.logger.info({ event: 'achievement_badge_not_found_for_revocation', userId, badgeId });
      throw new BadgeNotFoundError(badgeId);
    }

    const result = await this.badgeRevocationService.revokeBadge({
      userId,
      badgeId,
      revokedBy,
      reason: 'Manual correction by administrator',
    });

    if (!result.success) {
      this.logger.info({
        event: 'achievement_badge_revocation_not_found',
        userId,
        badgeId,
        error: result.error,
      });
      throw new UserBadgeOwnershipNotFoundError(userId, badgeId);
    }

    this.logger.info({
      event: 'achievement_badge_revoked_by_admin',
      userId,
      badgeId,
      revokedBy,
    });

    // Audit: badge revocation by an admin is a sensitive
    // action — the previous code only logged it, which is not
    // a durable record. The cross-domain audit log captures
    // who revoked whose badge so the user can challenge the
    // action later and so the platform can answer "which
    // badges did admin X revoke last month?".
    try {
      await this.auditLogService.record({
        eventType: 'badge.revoked',
        domain: 'achievement',
        action: 'badge.revoked',
        actorId: revokedBy,
        subjectUserId: userId,
        metadata: {
          badgeId,
          badgeName: badge.name,
        },
      });
    } catch (error) {
      this.logger.error({
        event: 'achievement_badge_revocation_audit_write_failed',
        userId,
        badgeId,
        revokedBy,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  async getPublicAchievementProfile(
    userId: string,
    requesterId: string,
  ): Promise<PublicAchievementProfileResponseDto> {
    await this.assertUserExists(userId);
    await this.userDomainService.assertProfileVisible(userId, requesterId);

    const profile = await this.achievementRepository.getPublicAchievementProfile(userId);

    if (!profile) {
      this.logger.info({ event: 'achievement_public_profile_not_found', userId });
      throw new AchievementUserNotFoundError(userId);
    }

    return {
      userId: profile.userId,
      totalBadges: profile.totalBadges,
      rareBadges: profile.rareBadges,
      highestRank: profile.highestRank,
      featuredBadges: profile.featuredBadges.map((badge) => this.toFeaturedBadgeResponse(badge)),
    };
  }

  private toBadgeDetailsResponse(badgeDetails: BadgeDetailsRow): BadgeDetailsResponseDto {
    return {
      id: badgeDetails.badgeId,
      name: badgeDetails.name,
      description: badgeDetails.description,
      rarity: badgeDetails.rarity,
      earnedCount: badgeDetails.earnedCount,
    };
  }

  private toBadgeProgressResponse(
    badgeId: string,
    progressSnapshot: BadgeProgressSnapshot,
  ): BadgeProgressResponseDto {
    return {
      badgeId,
      current: progressSnapshot.current,
      target: progressSnapshot.target,
      percent: progressSnapshot.percent,
    };
  }

  private toFeaturedBadgeResponse(badge: FeaturedBadgeRow): FeaturedBadgeResponseDto {
    return {
      badgeId: badge.badgeId,
      badgeName: badge.badgeName,
      rarity: badge.rarity,
    };
  }

  private toBadgeCatalogItemResponse(badge: BadgeCatalogRow): BadgeCatalogItemResponseDto {
    return {
      id: badge.badgeId,
      name: badge.name,
      description: badge.description,
      rarity: badge.rarity,
      earnedCount: badge.earnedCount,
    };
  }

  async reevaluateUserForController(userId: string): Promise<ReevaluateUserResponseDto> {
    const results = await this.scheduledEvaluationService.reevaluateUserBadges(userId);

    const awarded = results.filter((r) => r.awarded).length;
    const errors = results.filter((r) => !!r.error).length;

    return {
      message: `Re-evaluation completed for user ${userId}. Awarded ${awarded} badge(s), ${errors} error(s).`,
      checked: results.length,
      awarded,
      errors,
    };
  }

  async getUserHistoryForController(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{
    items: AdminAchievementHistoryItemDto[];
    total: number;
    limit?: number;
    offset?: number;
  }> {
    const { entries, total } = await this.achievementHistoryService.getUserHistory(userId, {
      includeRevoked: true,
      limit: options?.limit,
      offset: options?.offset,
    });

    return {
      items: entries.map((entry) => ({
        userBadgeId: entry.userBadgeId,
        userId: entry.userId,
        badgeId: entry.badgeId,
        badgeSlug: entry.badgeSlug,
        badgeName: entry.badgeName,
        badgeType: entry.badgeType,
        badgeCategory: entry.badgeCategory,
        earnedAt: entry.earnedAt.toISOString(),
        badgeVersion: entry.badgeVersion,
        expiresAt: entry.expiresAt?.toISOString() ?? null,
        revokedAt: entry.revokedAt?.toISOString() ?? null,
        revocationReason: entry.revocationReason,
        metadata: entry.metadata,
        isActive: entry.isActive,
      })),
      total,
      limit: options?.limit,
      offset: options?.offset,
    };
  }

  private async assertUserExists(userId: string): Promise<void> {
    try {
      await this.userDomainService.getMe(userId);
    } catch {
      throw new AchievementUserNotFoundError(userId);
    }
  }
}
