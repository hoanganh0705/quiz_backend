/**
 * Achievement Application Service
 *
 * Subscribes to Ranking domain events and triggers achievement evaluation.
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ConsistencyService,
  ProgressTrackingService,
  RankAchievementService,
  AchievementHistoryService,
  BadgeAnalyticsService,
  BadgeRevocationService,
} from '../domain/services';
import { UserDomainService } from '@/modules/user/domain/user.service';
import { RANKING_DOMAIN_EVENT_BUS } from '@/modules/ranking';
import type { PublishedRankingDomainEvent, RankingDomainEventBusPort } from '@/modules/ranking';
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
import type { BadgeDetailsResponseDto } from '../dto/response/badge-details-response.dto';
import type { BadgeProgressResponseDto } from '../dto/response/badge-progress-response.dto';
import type { AchievementHistoryItemResponseDto } from '../dto/response/achievement-history-item-response.dto';
import type { UserBadgeAnalyticsResponseDto } from '../dto/response/user-badge-analytics-response.dto';
import type { BadgeCatalogItemResponseDto } from '../dto/response/badge-catalog-item-response.dto';
import type {
  PublicAchievementProfileResponseDto,
  FeaturedBadgeResponseDto,
} from '../dto/response/public-achievement-profile-response.dto';
import type { BadgeProgressSnapshot } from '../domain/services/progress-tracking.service';

@Injectable()
export class AchievementApplicationService implements OnModuleInit {
  constructor(
    private readonly rankAchievementService: RankAchievementService,
    private readonly consistencyService: ConsistencyService,
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly achievementHistoryService: AchievementHistoryService,
    private readonly badgeAnalyticsService: BadgeAnalyticsService,
    private readonly badgeRevocationService: BadgeRevocationService,
    private readonly userDomainService: UserDomainService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(AchievementApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getBadgeCatalog(): Promise<BadgeCatalogItemResponseDto[]> {
    const badges = await this.achievementRepository.getBadgeCatalog();

    return badges.map((badge) => this.toBadgeCatalogItemResponse(badge));
  }

  async getBadgeDetails(badgeId: string): Promise<BadgeDetailsResponseDto> {
    const badgeDetails = await this.achievementRepository.getBadgeDetailsById(badgeId);

    if (!badgeDetails) {
      this.logger.warn({ event: 'achievement_badge_not_found', badgeId });
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
      this.logger.warn({ event: 'achievement_badge_progress_not_found', userId, badgeId });
      throw new BadgeNotFoundError(badgeId);
    }

    return this.toBadgeProgressResponse(badgeId, progressSnapshot);
  }

  async getMyAchievementHistory(userId: string): Promise<AchievementHistoryItemResponseDto[]> {
    const history = await this.achievementHistoryService.getUserHistory(userId, {
      includeRevoked: false,
    });

    return history.map((entry) => ({
      badgeId: entry.badgeId,
      badgeName: entry.badgeName,
      earnedAt: entry.earnedAt.toISOString(),
    }));
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

  async revokeUserBadge(userId: string, badgeId: string, revokedBy: string): Promise<void> {
    await this.assertUserExists(userId);

    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      this.logger.warn({ event: 'achievement_badge_not_found_for_revocation', userId, badgeId });
      throw new BadgeNotFoundError(badgeId);
    }

    const result = await this.badgeRevocationService.revokeBadge({
      userId,
      badgeId,
      revokedBy,
      reason: 'Manual correction by administrator',
    });

    if (!result.success) {
      this.logger.warn({
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

  async getPublicAchievementProfile(userId: string): Promise<PublicAchievementProfileResponseDto> {
    await this.assertUserExists(userId);

    const profile = await this.achievementRepository.getPublicAchievementProfile(userId);

    if (!profile) {
      this.logger.warn({ event: 'achievement_public_profile_not_found', userId });
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

  onModuleInit(): void {
    this.subscribeToRankingEvents();
  }

  private subscribeToRankingEvents(): void {
    this.eventBus.subscribe((event) => {
      void this.handleRankingEvent(event);
    });

    this.logger.info({
      event: 'achievement_application_service_subscribed',
    });
  }

  private async handleRankingEvent(event: PublishedRankingDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'rank.changed':
        await this.handleRankChanged(event);
        break;

      case 'xp.added':
        await this.handleXpAdded(event);
        break;

      case 'peak.rank.achieved':
        await this.handlePeakRankAchieved(event);
        break;

      case 'ranking.milestone':
        this.handleRankingMilestone(event);
        break;
    }
  }

  private async handleRankChanged(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'rank.changed' }>,
  ): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newRank,
        previousRank: event.previousRank,
        xp: 0,
      });
    } catch (error) {
      this.logger.error({
        event: 'rank_achievement_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleXpAdded(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'xp.added' }>,
  ): Promise<void> {
    try {
      await this.consistencyService.awardConsistencyBadge({
        userId: event.userId,
        streakDays: 1,
      });
    } catch (error) {
      this.logger.error({
        event: 'consistency_badge_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handlePeakRankAchieved(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'peak.rank.achieved' }>,
  ): Promise<void> {
    try {
      await this.rankAchievementService.checkRankAchievements({
        userId: event.userId,
        period: event.period,
        currentRank: event.newPeakRank,
        previousRank: null,
        xp: 0,
      });
    } catch (error) {
      this.logger.error({
        event: 'peak_rank_achievement_check_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleRankingMilestone(
    event: Extract<PublishedRankingDomainEvent, { eventType: 'ranking.milestone' }>,
  ): void {
    this.logger.debug({
      event: 'ranking_milestone_received',
      userId: event.userId,
      milestoneType: event.milestoneType,
      rank: event.rank,
    });
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
