/**
 * Badge Analytics Service
 *
 * Provides analytics and statistics for achievements:
 * - Platform-wide achievement metrics
 * - User achievement analytics
 * - Badge popularity and earning trends
 * - Achievement completion rates
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

export interface PlatformAchievementStats {
  totalBadges: number;
  activeBadges: number;
  deprecatedBadges: number;
  totalAwards: number;
  uniqueEarners: number;
  averageBadgesPerUser: number;
  awardsLast24Hours: number;
  awardsLast7Days: number;
  awardsLast30Days: number;
}

export interface BadgeAnalytics {
  badgeId: string;
  slug: string;
  name: string;
  totalEarners: number;
  earnedLast24Hours: number;
  earnedLast7Days: number;
  earnedLast30Days: number;
  averageTimeToEarn: number; // days
  fastestEarnTime: number; // hours
  topEarners: { userId: string; earnedAt: Date }[];
}

export interface CategoryAnalytics {
  category: string;
  badgeCount: number;
  totalEarners: number;
  averageEarnersPerBadge: number;
  mostPopularBadge: string;
  leastPopularBadge: string;
}

export interface UserAchievementAnalytics {
  userId: string;
  totalBadges: number;
  badgesByCategory: Record<string, number>;
  badgesByTier: Record<string, number>;
  achievementRate: number; // badges per week
  recentActivity: { date: string; badgesEarned: number }[];
  completionPercentage: number; // % of available badges earned
  nextMilestone: { name: string; badgesNeeded: number };
}

export interface TrendAnalysis {
  date: string;
  newAwards: number;
  cumulativeAwards: number;
  activeEarners: number;
}

export interface BadgePopularityRanking {
  rank: number;
  badgeId: string;
  slug: string;
  name: string;
  earnerCount: number;
  trend: 'rising' | 'stable' | 'declining';
}

@Injectable()
export class BadgeAnalyticsService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(BadgeAnalyticsService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get platform-wide achievement statistics.
   */
  async getPlatformStats(): Promise<PlatformAchievementStats> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    let totalAwards = 0;
    const uniqueEarners = 0;
    const awardsLast24Hours = 0;
    const awardsLast7Days = 0;
    const awardsLast30Days = 0;

    for (const badge of badges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
      totalAwards += earnerCount;
    }

    // These would need actual queries in a real implementation
    // For now, return placeholder calculations
    const averageBadgesPerUser = uniqueEarners > 0 ? totalAwards / uniqueEarners : 0;

    return {
      totalBadges: badges.length,
      activeBadges: badges.filter((b) => b.isActive).length,
      deprecatedBadges: badges.filter((b) => !b.isActive).length,
      totalAwards,
      uniqueEarners,
      averageBadgesPerUser: Math.round(averageBadgesPerUser * 100) / 100,
      awardsLast24Hours,
      awardsLast7Days,
      awardsLast30Days,
    };
  }

  /**
   * Get analytics for a specific badge.
   */
  async getBadgeAnalytics(badgeId: string): Promise<BadgeAnalytics | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badgeId);
    const topEarners = await this.getTopEarners(badgeId, 5);

    return {
      badgeId,
      slug: badge.slug,
      name: badge.name,
      totalEarners: earnerCount,
      earnedLast24Hours: 0, // Would need actual query
      earnedLast7Days: 0,
      earnedLast30Days: 0,
      averageTimeToEarn: 0,
      fastestEarnTime: 0,
      topEarners,
    };
  }

  /**
   * Get analytics by category.
   */
  async getCategoryAnalytics(): Promise<CategoryAnalytics[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    const categoryMap = new Map<string, { badges: BadgeDefinitionRow[]; earnerCounts: number[] }>();

    for (const badge of badges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
      const existing = categoryMap.get(badge.category) ?? { badges: [], earnerCounts: [] };
      existing.badges.push(badge);
      existing.earnerCounts.push(earnerCount);
      categoryMap.set(badge.category, existing);
    }

    const analytics: CategoryAnalytics[] = [];

    for (const [category, data] of categoryMap) {
      const totalEarners = data.earnerCounts.reduce((sum, count) => sum + count, 0);
      const averageEarnersPerBadge = data.badges.length > 0 ? totalEarners / data.badges.length : 0;

      // Find most and least popular
      const sortedBadges = data.badges
        .map((b, i) => ({ badge: b, count: data.earnerCounts[i] }))
        .sort((a, b) => b.count - a.count);

      analytics.push({
        category,
        badgeCount: data.badges.length,
        totalEarners,
        averageEarnersPerBadge: Math.round(averageEarnersPerBadge * 100) / 100,
        mostPopularBadge: sortedBadges[0]?.badge.slug ?? '',
        leastPopularBadge: sortedBadges[sortedBadges.length - 1]?.badge.slug ?? '',
      });
    }

    return analytics.sort((a, b) => b.totalEarners - a.totalEarners);
  }

  /**
   * Get detailed analytics for a user.
   */
  async getUserAnalytics(userId: string): Promise<UserAchievementAnalytics> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);

    const badgesByCategory: Record<string, number> = {};
    const badgesByTier: Record<string, number> = {};

    for (const userBadge of userBadges) {
      // Count by category
      badgesByCategory[userBadge.badge.category] =
        (badgesByCategory[userBadge.badge.category] ?? 0) + 1;

      // Count by type
      badgesByTier[userBadge.badge.type] = (badgesByTier[userBadge.badge.type] ?? 0) + 1;
    }

    // Calculate achievement rate (badges per week)
    const now = new Date();
    let oldestAward = now;
    for (const badge of userBadges) {
      if (badge.earnedAt < oldestAward) {
        oldestAward = badge.earnedAt;
      }
    }
    const weeksActive = Math.max(
      1,
      Math.ceil((now.getTime() - oldestAward.getTime()) / (7 * 24 * 60 * 60 * 1000)),
    );
    const achievementRate = userBadges.length / weeksActive;

    // Calculate recent activity (last 7 days grouped by day)
    const recentActivity: { date: string; badgesEarned: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const badgesOnDate = userBadges.filter((b) => {
        const badgeDate = b.earnedAt.toISOString().split('T')[0];
        return badgeDate === dateStr;
      }).length;

      recentActivity.push({ date: dateStr, badgesEarned: badgesOnDate });
    }

    // Calculate completion percentage
    const allBadges = await this.achievementRepository.getAllActiveBadges();
    const completionPercentage =
      allBadges.length > 0 ? (userBadges.length / allBadges.length) * 100 : 0;

    // Determine next milestone
    const milestones = [1, 5, 10, 25, 50, 100, 250, 500];
    const nextMilestone =
      milestones.find((m) => m > userBadges.length) ?? milestones[milestones.length - 1];

    return {
      userId,
      totalBadges: userBadges.length,
      badgesByCategory,
      badgesByTier,
      achievementRate: Math.round(achievementRate * 100) / 100,
      recentActivity,
      completionPercentage: Math.round(completionPercentage * 100) / 100,
      nextMilestone: {
        name: `${nextMilestone} Badges`,
        badgesNeeded: nextMilestone - userBadges.length,
      },
    };
  }

  /**
   * Get trend analysis for badges over time.
   */
  getTrendAnalysis(days: number = 30): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    const now = new Date();

    // This would need actual time-series data in a real implementation
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      trends.push({
        date: dateStr,
        newAwards: 0, // Would query actual data
        cumulativeAwards: 0,
        activeEarners: 0,
      });
    }

    return Promise.resolve(trends);
  }

  /**
   * Get badge popularity ranking.
   */
  async getPopularityRanking(limit: number = 50): Promise<BadgePopularityRanking[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    const rankings: BadgePopularityRanking[] = [];

    for (const badge of badges) {
      const earnerCount = await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);

      rankings.push({
        rank: 0,
        badgeId: badge.badgeId,
        slug: badge.slug,
        name: badge.name,
        earnerCount,
        trend: 'stable',
      });
    }

    // Sort by earner count
    rankings.sort((a, b) => b.earnerCount - a.earnerCount);

    // Assign ranks
    rankings.forEach((r, index) => {
      r.rank = index + 1;
    });

    return rankings.slice(0, limit);
  }

  /**
   * Get time until next milestone for a user.
   */
  async getTimeToNextMilestone(
    userId: string,
  ): Promise<{ milestone: number; estimatedDays: number } | null> {
    const userBadges = await this.achievementRepository.getUserBadgesWithDetails(userId);
    const currentCount = userBadges.length;

    const milestones = [1, 5, 10, 25, 50, 100, 250, 500];
    const nextMilestone = milestones.find((m) => m > currentCount);

    if (!nextMilestone) return null;

    // Estimate based on average achievement rate
    const analytics = await this.getUserAnalytics(userId);
    const badgesNeeded = nextMilestone - currentCount;

    const estimatedDays =
      analytics.achievementRate > 0 ? Math.ceil((badgesNeeded / analytics.achievementRate) * 7) : 0;

    return {
      milestone: nextMilestone,
      estimatedDays,
    };
  }

  /**
   * Get top earners for a badge.
   */
  private getTopEarners(
    badgeId: string,
    limit: number,
  ): Promise<{ userId: string; earnedAt: Date }[]> {
    // In a real implementation, this would query userBadges ordered by earnedAt
    this.logger.debug({
      event: 'get_top_earners',
      badgeId,
      limit,
    });

    return Promise.resolve([]);
  }

  /**
   * Calculate badge earning velocity (awards per day).
   */
  async calculateEarningVelocity(badgeId: string, days: number = 7): Promise<number> {
    const analytics = await this.getBadgeAnalytics(badgeId);
    if (!analytics) return 0;

    const velocity = analytics.earnedLast7Days / days;
    return Math.round(velocity * 100) / 100;
  }

  /**
   * Get completion rate for a badge category.
   */
  async getCategoryCompletionRate(category: string, totalUsers: number): Promise<number> {
    const badges = await this.achievementRepository.getBadgesByCategory(category as never);

    if (badges.length === 0 || totalUsers === 0) return 0;

    let totalEarners = 0;
    for (const badge of badges) {
      totalEarners += await this.achievementRepository.getBadgeEarnersCount(badge.badgeId);
    }

    const averageEarnersPerBadge = totalEarners / badges.length;
    const completionRate = (averageEarnersPerBadge / totalUsers) * 100;

    return Math.round(completionRate * 100) / 100;
  }
}
