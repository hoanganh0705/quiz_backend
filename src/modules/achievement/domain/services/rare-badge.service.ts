/**
 * Rare Badge Service
 *
 * Handles rare and exclusive badge discovery:
 * - Badges with fewest earners (achievement hunting motivation)
 * - Exclusive badge discovery
 * - Badge rarity tiers
 * - First-to-earn tracking
 *
 * Design principles:
 * - Creates motivation through exclusivity
 * - Shows users their progress toward rare achievements
 * - Celebrates early adopters
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';

export enum RarityTier {
  COMMON = 'common', // > 1000 earners
  UNCOMMON = 'uncommon', // 100-1000 earners
  RARE = 'rare', // 10-100 earners
  EPIC = 'epic', // 1-10 earners
  LEGENDARY = 'legendary', // First 10 users to earn it
  EXCLUSIVE = 'exclusive', // Limited-time, never repeatable
}

export interface BadgeRarityInfo {
  badgeId: string;
  slug: string;
  name: string;
  tier: RarityTier;
  earnerCount: number;
  rarityPercentage: number;
  totalUsers: number;
}

export interface RareBadgeDiscovery {
  badgeId: string;
  slug: string;
  name: string;
  description: string;
  tier: RarityTier;
  isEarned: boolean;
  earnerRank?: number;
  firstEarners?: { userId: string; earnedAt: Date }[];
}

export interface RarityLeaderboard {
  badgeId: string;
  slug: string;
  name: string;
  topEarners: { userId: string; earnedAt: Date; earnerRank: number }[];
  totalEarners: number;
}

export interface AchievementHunterProfile {
  userId: string;
  totalBadges: number;
  rareBadges: number;
  epicBadges: number;
  legendaryBadges: number;
  exclusiveBadges: number;
  rarityScore: number;
  rank: number;
}

@Injectable()
export class RareBadgeService {
  private readonly rarityThresholds = {
    [RarityTier.COMMON]: 1000,
    [RarityTier.UNCOMMON]: 100,
    [RarityTier.RARE]: 10,
    [RarityTier.EPIC]: 1,
  };

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(RareBadgeService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Determine the rarity tier based on earner count.
   */
  getRarityTier(earnerCount: number): RarityTier {
    if (earnerCount >= this.rarityThresholds[RarityTier.COMMON]) {
      return RarityTier.COMMON;
    }
    if (earnerCount >= this.rarityThresholds[RarityTier.UNCOMMON]) {
      return RarityTier.UNCOMMON;
    }
    if (earnerCount >= this.rarityThresholds[RarityTier.RARE]) {
      return RarityTier.RARE;
    }
    if (earnerCount >= this.rarityThresholds[RarityTier.EPIC]) {
      return RarityTier.EPIC;
    }
    return RarityTier.LEGENDARY;
  }

  /**
   * Get rarity information for a badge.
   */
  async getBadgeRarity(badgeId: string, totalUsers: number): Promise<BadgeRarityInfo | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badgeId);
    const tier = this.getRarityTier(earnerCount);
    const rarityPercentage = totalUsers > 0 ? (earnerCount / totalUsers) * 100 : 0;

    return {
      badgeId,
      slug: badge.slug,
      name: badge.name,
      tier,
      earnerCount,
      rarityPercentage: Math.round(rarityPercentage * 100) / 100,
      totalUsers,
    };
  }

  /**
   * Get all badges sorted by rarity (rarest first).
   */
  async getRarestBadges(limit: number = 10): Promise<BadgeRarityInfo[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const rarities: BadgeRarityInfo[] = [];

    for (const badge of badges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
      const tier = this.getRarityTier(earnerCount);

      rarities.push({
        badgeId: badge.badgeId,
        slug: badge.slug,
        name: badge.name,
        tier,
        earnerCount,
        rarityPercentage: 0, // Would need total users
        totalUsers: 0,
      });
    }

    // Sort by earner count (ascending = rarest first)
    rarities.sort((a, b) => a.earnerCount - b.earnerCount);

    return rarities.slice(0, limit);
  }

  /**
   * Get badges by rarity tier.
   */
  async getBadgesByTier(tier: RarityTier): Promise<BadgeRarityInfo[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const rarities: BadgeRarityInfo[] = [];

    for (const badge of badges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
      const badgeTier = this.getRarityTier(earnerCount);

      if (badgeTier === tier) {
        rarities.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          name: badge.name,
          tier: badgeTier,
          earnerCount,
          rarityPercentage: 0,
          totalUsers: 0,
        });
      }
    }

    return rarities;
  }

  /**
   * Get rare badges not yet earned by a user.
   * Useful for "Achievement hunting" motivation.
   */
  async getUnearnedRareBadges(userId: string, limit: number = 10): Promise<RareBadgeDiscovery[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const userBadges = await this.achievementRepository.getUserBadges(userId);
    const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

    const discoveries: RareBadgeDiscovery[] = [];

    for (const badge of badges) {
      if (earnedBadgeIds.has(badge.badgeId)) continue;

      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
      const tier = this.getRarityTier(earnerCount);

      // Only include uncommon or rarer
      if (tier === RarityTier.COMMON) continue;

      discoveries.push({
        badgeId: badge.badgeId,
        slug: badge.slug,
        name: badge.name,
        description: badge.description ?? '',
        tier,
        isEarned: false,
      });
    }

    // Sort by rarity (rarest first)
    discoveries.sort((a, b) => {
      const tierOrder = [
        RarityTier.LEGENDARY,
        RarityTier.EPIC,
        RarityTier.RARE,
        RarityTier.UNCOMMON,
      ];
      return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
    });

    return discoveries.slice(0, limit);
  }

  /**
   * Get the user's earner rank for a badge.
   */
  getEarnerRank(userId: string, badgeId: string): Promise<number | null> {
    // In a real implementation, this would query userBadges ordered by earnedAt
    // and find the user's position
    this.logger.debug({
      event: 'get_earner_rank',
      userId,
      badgeId,
    });

    return Promise.resolve(null);
  }

  /**
   * Get first earners of a badge (pioneers).
   */
  getFirstEarners(
    badgeId: string,
    limit: number = 10,
  ): Promise<{ userId: string; earnedAt: Date }[]> {
    // In a real implementation, this would query userBadges ordered by earnedAt ASC
    this.logger.debug({
      event: 'get_first_earners',
      badgeId,
      limit,
    });

    return Promise.resolve([]);
  }

  /**
   * Get rarity leaderboard for a badge.
   */
  async getBadgeLeaderboard(badgeId: string): Promise<RarityLeaderboard | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    const firstEarners = await this.getFirstEarners(badgeId, 10);

    return {
      badgeId,
      slug: badge.slug,
      name: badge.name,
      topEarners: firstEarners.map((fe, index) => ({
        ...fe,
        earnerRank: index + 1,
      })),
      totalEarners: await this.achievementRepository.getBadgeEarnersCount(badgeId),
    };
  }

  /**
   * Calculate a user's achievement hunter score.
   * Score = sum of rarity points for each badge earned.
   */
  async calculateRarityScore(userId: string): Promise<number> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);

    let score = 0;

    for (const userBadge of userBadges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(userBadge.badgeId);
      const tier = this.getRarityTier(earnerCount);

      // Points based on tier
      switch (tier) {
        case RarityTier.COMMON:
          score += 1;
          break;
        case RarityTier.UNCOMMON:
          score += 5;
          break;
        case RarityTier.RARE:
          score += 20;
          break;
        case RarityTier.EPIC:
          score += 100;
          break;
        case RarityTier.LEGENDARY:
          score += 500;
          break;
        case RarityTier.EXCLUSIVE:
          score += 1000;
          break;
      }
    }

    return score;
  }

  /**
   * Get a user's achievement hunter profile.
   */
  async getAchievementHunterProfile(userId: string): Promise<AchievementHunterProfile> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);

    const profile: AchievementHunterProfile = {
      userId,
      totalBadges: userBadges.length,
      rareBadges: 0,
      epicBadges: 0,
      legendaryBadges: 0,
      exclusiveBadges: 0,
      rarityScore: 0,
      rank: 0,
    };

    for (const userBadge of userBadges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(userBadge.badgeId);
      const tier = this.getRarityTier(earnerCount);

      switch (tier) {
        case RarityTier.RARE:
          profile.rareBadges++;
          profile.rarityScore += 20;
          break;
        case RarityTier.EPIC:
          profile.epicBadges++;
          profile.rarityScore += 100;
          break;
        case RarityTier.LEGENDARY:
          profile.legendaryBadges++;
          profile.rarityScore += 500;
          break;
        case RarityTier.EXCLUSIVE:
          profile.exclusiveBadges++;
          profile.rarityScore += 1000;
          break;
        default:
          profile.rarityScore += 1;
      }
    }

    return profile;
  }

  /**
   * Get top achievement hunters.
   */
  getTopAchievementHunters(limit: number = 10): Promise<AchievementHunterProfile[]> {
    // In a real implementation, this would aggregate scores across all users
    this.logger.debug({
      event: 'get_top_hunters',
      limit,
    });

    return Promise.resolve([]);
  }

  /**
   * Check if a badge is exclusive (limited-time).
   */
  async isExclusiveBadge(badgeId: string): Promise<boolean> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return false;

    // A badge is exclusive if it has a validUntil date
    return badge.category === 'seasonal' || badge.category === 'event';
  }
}
