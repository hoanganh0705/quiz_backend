/**
 * Badge Analytics Service
 *
 * Provides analytics and statistics for achievements:
 * - Platform-wide achievement metrics
 * - User achievement analytics
 * - Badge popularity and earning trends
 * - Achievement completion rates
 *
 * All methods that need earner counts for multiple badges use
 * getBadgeEarnersCounts() to avoid N+1 query patterns.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';
import {
  ACHIEVEMENT_MILESTONES,
  computeRarityString,
} from '../../domain/constants/achievement.constants';

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
  averageTimeToEarn: number;
  fastestEarnTime: number;
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
  achievementRate: number;
  recentActivity: { date: string; badgesEarned: number }[];
  completionPercentage: number;
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

export interface UserBadgeAnalyticsSnapshot {
  totalBadges: number;
  rareBadges: number;
  completionRate: number;
  latestBadgeEarnedAt: Date | null;
}

@Injectable()
export class BadgeAnalyticsService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(BadgeAnalyticsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getUserBadgeAnalyticsSnapshot(userId: string): Promise<UserBadgeAnalyticsSnapshot> {
    const [userBadges, allBadges] = await Promise.all([
      this.achievementRepository.getUserBadgesWithDetails(userId).then((r) => r.data),
      this.achievementRepository.getAllActiveBadges(),
    ]);

    const earnerCounts =
      userBadges.length > 0
        ? await this.achievementRepository.getBadgeEarnersCounts(userBadges.map((ub) => ub.badgeId))
        : {};

    let rareBadges = 0;
    let latestBadgeEarnedAt: Date | null = null;

    for (const userBadge of userBadges) {
      const earnerCount = earnerCounts[userBadge.badgeId] ?? 0;
      const rarity = computeRarityString(earnerCount);

      if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
        rareBadges++;
      }

      if (!latestBadgeEarnedAt || userBadge.earnedAt > latestBadgeEarnedAt) {
        latestBadgeEarnedAt = userBadge.earnedAt;
      }
    }

    const rawCompletionRate =
      allBadges.length > 0 ? (userBadges.length / allBadges.length) * 100 : 0;
    const completionRate = Math.min(100, Math.max(0, Math.floor(rawCompletionRate)));

    this.logger.debug({
      event: 'user_badge_analytics_snapshot_resolved',
      userId,
      totalBadges: userBadges.length,
      rareBadges,
      completionRate,
      latestBadgeEarnedAt: latestBadgeEarnedAt?.toISOString() ?? null,
    });

    return {
      totalBadges: userBadges.length,
      rareBadges,
      completionRate,
      latestBadgeEarnedAt,
    };
  }

  async getPlatformStats(): Promise<PlatformAchievementStats> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    const earnerCounts = await this.achievementRepository.getBadgeEarnersCounts(
      badges.map((b) => b.badgeId),
    );

    let totalAwards = 0;
    for (const count of Object.values(earnerCounts)) {
      totalAwards += count;
    }

    // Calculate unique earners by querying distinct user IDs who have earned any badge
    const uniqueEarnersList = await this.achievementRepository.getDistinctBadgeEarners();
    const uniqueEarners = uniqueEarnersList.length;
    const averageBadgesPerUser = uniqueEarners > 0 ? totalAwards / uniqueEarners : 0;

    // Calculate time-windowed awards
    const awardTimeline = await this.calculatePlatformAwardTimeline(badges);

    return {
      totalBadges: badges.length,
      activeBadges: badges.filter((b) => b.isActive).length,
      deprecatedBadges: badges.filter((b) => !b.isActive).length,
      totalAwards,
      uniqueEarners,
      averageBadgesPerUser: Math.round(averageBadgesPerUser * 100) / 100,
      awardsLast24Hours: awardTimeline.last24Hours,
      awardsLast7Days: awardTimeline.last7Days,
      awardsLast30Days: awardTimeline.last30Days,
    };
  }

  /**
   * Calculate platform-wide award counts for different time windows.
   */
  private async calculatePlatformAwardTimeline(
    badges: { badgeId: string }[],
  ): Promise<{ last24Hours: number; last7Days: number; last30Days: number }> {
    if (badges.length === 0) {
      return { last24Hours: 0, last7Days: 0, last30Days: 0 };
    }

    const badgeIds = badges.map((b) => b.badgeId);

    // Get earners timeline for all badges and aggregate
    const timelinePromises = badgeIds.map((badgeId) =>
      this.achievementRepository.getBadgeEarnersCountTimeline(badgeId),
    );

    const timelines = await Promise.all(timelinePromises);

    let last24Hours = 0;
    let last7Days = 0;
    let last30Days = 0;

    for (const timeline of timelines) {
      last24Hours += timeline.last24Hours;
      last7Days += timeline.last7Days;
      last30Days += timeline.last30Days;
    }

    return { last24Hours, last7Days, last30Days };
  }

  async getBadgeAnalytics(badgeId: string): Promise<BadgeAnalytics | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    const [totalEarners, timeline, topEarners] = await Promise.all([
      this.achievementRepository.getBadgeEarnersCount(badgeId),
      this.achievementRepository.getBadgeEarnersCountTimeline(badgeId),
      this.getTopEarners(badgeId, 5),
    ]);

    return {
      badgeId,
      slug: badge.slug,
      name: badge.name,
      totalEarners,
      earnedLast24Hours: timeline.last24Hours,
      earnedLast7Days: timeline.last7Days,
      earnedLast30Days: timeline.last30Days,
      averageTimeToEarn: 0,
      fastestEarnTime: 0,
      topEarners,
    };
  }

  async getCategoryAnalytics(): Promise<CategoryAnalytics[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    const earnerCounts = await this.achievementRepository.getBadgeEarnersCounts(
      badges.map((b) => b.badgeId),
    );

    const categoryMap = new Map<string, { badges: BadgeDefinitionRow[]; earnerCounts: number[] }>();

    for (const badge of badges) {
      const earnerCount = earnerCounts[badge.badgeId] ?? 0;
      const existing = categoryMap.get(badge.category) ?? { badges: [], earnerCounts: [] };
      existing.badges.push(badge);
      existing.earnerCounts.push(earnerCount);
      categoryMap.set(badge.category, existing);
    }

    const analytics: CategoryAnalytics[] = [];

    for (const [category, data] of categoryMap) {
      const totalEarners = data.earnerCounts.reduce((sum, count) => sum + count, 0);
      const averageEarnersPerBadge = data.badges.length > 0 ? totalEarners / data.badges.length : 0;

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

  async getUserAnalytics(userId: string): Promise<UserAchievementAnalytics> {
    const { data: userBadges } = await this.achievementRepository.getUserBadgesWithDetails(userId);

    const badgesByCategory: Record<string, number> = {};
    const badgesByTier: Record<string, number> = {};

    for (const userBadge of userBadges) {
      badgesByCategory[userBadge.badge.category] =
        (badgesByCategory[userBadge.badge.category] ?? 0) + 1;

      badgesByTier[userBadge.badge.type] = (badgesByTier[userBadge.badge.type] ?? 0) + 1;
    }

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

    const allBadges = await this.achievementRepository.getAllActiveBadges();
    const completionPercentage =
      allBadges.length > 0 ? (userBadges.length / allBadges.length) * 100 : 0;

    const nextMilestone =
      ACHIEVEMENT_MILESTONES.find((m) => m > userBadges.length) ??
      ACHIEVEMENT_MILESTONES[ACHIEVEMENT_MILESTONES.length - 1];

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

  async getTrendAnalysis(days: number = 30): Promise<TrendAnalysis[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const badgeIds = badges.map((b) => b.badgeId);

    if (badgeIds.length === 0) {
      const now = new Date();
      const trends: TrendAnalysis[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        trends.push({
          date: date.toISOString().split('T')[0],
          newAwards: 0,
          cumulativeAwards: 0,
          activeEarners: 0,
        });
      }
      return trends;
    }

    const trendData = await this.achievementRepository.getAwardTrendData(badgeIds, days);

    const awardCountsByDate = new Map<string, number>();
    for (const row of trendData) {
      const existing = awardCountsByDate.get(row.date) ?? 0;
      awardCountsByDate.set(row.date, existing + row.count);
    }

    let cumulative = 0;
    const trends: TrendAnalysis[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const newAwards = awardCountsByDate.get(dateStr) ?? 0;
      cumulative += newAwards;

      trends.push({
        date: dateStr,
        newAwards,
        cumulativeAwards: cumulative,
        activeEarners: 0,
      });
    }

    return trends;
  }

  async getPopularityRanking(limit: number = 50): Promise<BadgePopularityRanking[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();

    const earnerCounts = await this.achievementRepository.getBadgeEarnersCounts(
      badges.map((b) => b.badgeId),
    );

    const rankings: BadgePopularityRanking[] = badges.map((badge) => ({
      rank: 0,
      badgeId: badge.badgeId,
      slug: badge.slug,
      name: badge.name,
      earnerCount: earnerCounts[badge.badgeId] ?? 0,
      trend: 'stable' as const,
    }));

    rankings.sort((a, b) => b.earnerCount - a.earnerCount);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].rank = i + 1;
    }

    return rankings.slice(0, limit);
  }

  async getTimeToNextMilestone(
    userId: string,
  ): Promise<{ milestone: number; estimatedDays: number } | null> {
    const analytics = await this.getUserAnalytics(userId);
    const currentCount = analytics.totalBadges;

    const nextMilestone = ACHIEVEMENT_MILESTONES.find((m) => m > currentCount);

    if (!nextMilestone) return null;

    const badgesNeeded = nextMilestone - currentCount;

    const estimatedDays =
      analytics.achievementRate > 0 ? Math.ceil((badgesNeeded / analytics.achievementRate) * 7) : 0;

    return {
      milestone: nextMilestone,
      estimatedDays,
    };
  }

  async getTopEarners(
    badgeId: string,
    limit: number,
  ): Promise<{ userId: string; earnedAt: Date }[]> {
    this.logger.debug({
      event: 'get_top_earners',
      badgeId,
      limit,
    });

    return this.achievementRepository.getBadgeTopEarners(badgeId, limit);
  }

  async calculateEarningVelocity(badgeId: string, days: number = 7): Promise<number> {
    const analytics = await this.getBadgeAnalytics(badgeId);
    if (!analytics) return 0;

    const velocity = analytics.earnedLast7Days / days;
    return Math.round(velocity * 100) / 100;
  }

  async getCategoryCompletionRate(category: string, totalUsers: number): Promise<number> {
    const badges = await this.achievementRepository.getBadgesByCategory(category as never);

    if (badges.length === 0 || totalUsers === 0) return 0;

    const earnerCounts = await this.achievementRepository.getBadgeEarnersCounts(
      badges.map((b) => b.badgeId),
    );

    let totalEarners = 0;
    for (const count of Object.values(earnerCounts)) {
      totalEarners += count;
    }

    const averageEarnersPerBadge = totalEarners / badges.length;
    const completionRate = (averageEarnersPerBadge / totalUsers) * 100;

    return Math.round(completionRate * 100) / 100;
  }
}
