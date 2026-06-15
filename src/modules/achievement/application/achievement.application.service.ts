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
import type { BadgeDetailsResponseDto } from '../dto/response/badge-details-response.dto';
import type { BadgeProgressResponseDto } from '../dto/response/badge-progress-response.dto';
import type { AchievementHistoryItemResponseDto } from '../dto/response/achievement-history-item-response.dto';
import type { UserBadgeAnalyticsResponseDto } from '../dto/response/user-badge-analytics-response.dto';
import type { BadgeCatalogItemResponseDto } from '../dto/response/badge-catalog-item-response.dto';
import type { MyBadgesResponseDto } from '../dto/response/my-badges-response.dto';
import type {
  PublicAchievementProfileResponseDto,
  FeaturedBadgeResponseDto,
} from '../dto/response/public-achievement-profile-response.dto';
import type { BadgeProgressSnapshot } from './progress-tracking.service';

@Injectable()
export class AchievementApplicationService {
  constructor(
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly achievementHistoryService: AchievementHistoryService,
    private readonly badgeAnalyticsService: BadgeAnalyticsService,
    private readonly badgeRevocationService: BadgeRevocationService,
    private readonly userDomainService: UserDomainService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(AchievementApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getBadgeCatalog(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: BadgeCatalogItemResponseDto[]; total: number }> {
    const { data: badges, total } = await this.achievementRepository.getBadgeCatalog(params);

    return {
      data: badges.map((badge) => this.toBadgeCatalogItemResponse(badge)),
      total,
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
  ): Promise<{ data: AchievementHistoryItemResponseDto[]; total: number }> {
    const history = await this.achievementHistoryService.getUserHistory(userId, {
      includeRevoked: false,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });

    return {
      data: history.map((entry) => ({
        badgeId: entry.badgeId,
        badgeName: entry.badgeName,
        earnedAt: entry.earnedAt.toISOString(),
      })),
      total: history.length,
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
  ): Promise<MyBadgesResponseDto> {
    const { data: userBadges, total } = await this.achievementRepository.getUserBadgesWithDetails(
      userId,
      options,
    );

    const badgeIds = userBadges.map((ub) => ub.badgeId);
    const earnerCounts =
      badgeIds.length > 0 ? await this.achievementRepository.getBadgeEarnersCounts(badgeIds) : {};

    return {
      data: userBadges.map((ub) => ({
        badgeId: ub.badgeId,
        name: ub.badge.name,
        description: ub.badge.description,
        rarity: computeRarityString(earnerCounts[ub.badgeId] ?? 0),
        earnedAt: ub.earnedAt.toISOString(),
      })),
      total,
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

  private async assertUserExists(userId: string): Promise<void> {
    try {
      await this.userDomainService.getMe(userId);
    } catch {
      throw new AchievementUserNotFoundError(userId);
    }
  }
}
