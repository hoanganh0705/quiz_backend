import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BadgeType } from '../domain/types/achievement.types';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../infrastructure/repositories/achievement.repository';
import type {
  AchievementRepositoryPort,
  BadgeDefinitionRow,
} from '../infrastructure/repositories/achievement.repository';
import { BADGE_THRESHOLDS, PROGRESS_MILESTONES } from '../domain/constants/achievement.constants';

export enum ProgressVisibility {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
  CONDITIONAL = 'conditional',
}

export interface ProgressUpdate {
  current: number;
  target: number;
  percentage: number;
  lastUpdated: Date;
  isComplete: boolean;
}

export interface ProgressResponse {
  badgeId: string;
  slug: string;
  name: string;
  visibility: ProgressVisibility;
  progress: ProgressUpdate | null;
  isEarned: boolean;
}

export interface BadgeProgressSnapshot {
  current: number;
  target: number;
  percent: number;
}

const STREAK_BADGE_TARGETS: ReadonlyArray<{ type: string; days: number }> = [
  { type: BadgeType.STREAK_7, days: 7 },
  { type: BadgeType.STREAK_30, days: 30 },
  { type: BadgeType.STREAK_100, days: 100 },
];

@Injectable()
export class ProgressTrackingService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(ProgressTrackingService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getBadgeProgressSnapshot(
    userId: string,
    badgeId: string,
  ): Promise<BadgeProgressSnapshot | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      this.logger.debug({ event: 'badge_progress_badge_not_found', userId, badgeId });
      return null;
    }

    const rules = await this.achievementRepository.getBadgeRules(badgeId);
    const primaryRule = rules[0] ?? null;

    const target = this.resolveTarget(primaryRule?.config ?? null, badgeId);
    const current = await this.resolveCurrentProgress(
      userId,
      badgeId,
      primaryRule?.config ?? null,
      target,
    );
    const percent = this.calculatePercent(current, target);

    this.logger.debug({
      event: 'badge_progress_snapshot_resolved',
      userId,
      badgeId,
      current,
      target,
      percent,
    });

    return {
      current,
      target,
      percent,
    };
  }

  async getBadgeProgress(userId: string, badgeId: string): Promise<ProgressResponse | null> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return null;

    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    if (hasBadge) {
      return {
        badgeId: badge.badgeId,
        slug: badge.slug,
        name: badge.name,
        visibility: ProgressVisibility.VISIBLE,
        progress: null,
        isEarned: true,
      };
    }

    const storedProgress = await this.achievementRepository.getBadgeProgress(userId, badgeId);
    const visibility = this.determineVisibility(badge, storedProgress);

    return {
      badgeId: badge.badgeId,
      slug: badge.slug,
      name: badge.name,
      visibility,
      progress: storedProgress as ProgressUpdate | null,
      isEarned: false,
    };
  }

  async getUserProgress(userId: string): Promise<ProgressResponse[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const visibleBadges = badges.filter((b) => !b.isHidden);

    if (visibleBadges.length === 0) return [];

    const badgeIds = visibleBadges.map((b) => b.badgeId);
    const [ownershipMap, progressMap] = await Promise.all([
      this.achievementRepository.hasBadges(userId, badgeIds),
      this.achievementRepository.getBadgeProgressBatch(userId, badgeIds),
    ]);

    const results: ProgressResponse[] = [];
    for (const badge of visibleBadges) {
      const hasBadge = ownershipMap[badge.badgeId] ?? false;
      if (hasBadge) {
        results.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          name: badge.name,
          visibility: ProgressVisibility.VISIBLE,
          progress: null,
          isEarned: true,
        });
        continue;
      }

      const storedProgress = progressMap[badge.badgeId] ?? null;
      const visibility = this.determineVisibility(badge, storedProgress);

      if (visibility !== ProgressVisibility.HIDDEN) {
        results.push({
          badgeId: badge.badgeId,
          slug: badge.slug,
          name: badge.name,
          visibility,
          progress: storedProgress as ProgressUpdate | null,
          isEarned: false,
        });
      }
    }

    return results;
  }

  async updateProgress(
    userId: string,
    badgeId: string,
    current: number,
    target: number,
  ): Promise<ProgressUpdate> {
    const progress: ProgressUpdate = {
      current,
      target,
      percentage: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
      lastUpdated: new Date(),
      isComplete: current >= target,
    };

    const progressRecord: Record<string, unknown> = { ...progress };
    await this.achievementRepository.updateBadgeProgress(userId, badgeId, progressRecord);

    this.logger.debug({
      event: 'progress_updated',
      userId,
      badgeId,
      current,
      target,
      percentage: progress.percentage,
    });

    return progress;
  }

  async incrementProgress(
    userId: string,
    badgeId: string,
    increment: number = 1,
  ): Promise<ProgressUpdate | null> {
    const existingProgress = await this.achievementRepository.getBadgeProgress(userId, badgeId);

    if (!existingProgress) {
      const defaultTarget = 1;
      return this.updateProgress(userId, badgeId, increment, defaultTarget);
    }

    const current = (existingProgress.current as number) ?? 0;
    const target = (existingProgress.target as number) ?? 1;

    return this.updateProgress(userId, badgeId, current + increment, target);
  }

  async resetProgress(userId: string, badgeId: string): Promise<void> {
    await this.achievementRepository.updateBadgeProgress(userId, badgeId, {
      current: 0,
      target: 0,
      percentage: 0,
      lastUpdated: new Date(),
      isComplete: false,
    });
  }

  getMilestones(): Promise<number[]> {
    return Promise.resolve([...PROGRESS_MILESTONES]);
  }

  calculateStreakProgress(
    _userId: string,
    _badgeId: string,
    streakDays: number,
  ): Promise<ProgressUpdate> {
    const streakTargets = [
      BADGE_THRESHOLDS.STREAK.STREAK_7,
      BADGE_THRESHOLDS.STREAK.STREAK_30,
      BADGE_THRESHOLDS.STREAK.STREAK_100,
    ];
    let target = 1;

    for (const t of streakTargets) {
      if (streakDays < t) {
        target = t;
        break;
      }
      target = t;
    }

    return Promise.resolve({
      current: streakDays,
      target,
      percentage: target > 0 ? Math.min(100, Math.round((streakDays / target) * 100)) : 0,
      lastUpdated: new Date(),
      isComplete: streakDays >= target,
    });
  }

  calculateRankProgress(
    _userId: string,
    _badgeId: string,
    currentRank: number,
  ): Promise<ProgressUpdate> {
    const rankTargets: number[] = [
      BADGE_THRESHOLDS.RANK.RANK_1,
      BADGE_THRESHOLDS.RANK.TOP_10,
      BADGE_THRESHOLDS.RANK.TOP_100,
      BADGE_THRESHOLDS.RANK.TOP_1000,
    ];
    let target: number = BADGE_THRESHOLDS.RANK.TOP_1000;

    for (const t of rankTargets) {
      if (currentRank <= t) {
        target = t;
        break;
      }
    }

    const isComplete = currentRank <= target;
    const percentage = isComplete
      ? 100
      : target > 0
        ? Math.max(0, Math.round(100 - (currentRank / target) * 100))
        : 0;

    return Promise.resolve({
      current: currentRank,
      target,
      percentage,
      lastUpdated: new Date(),
      isComplete,
    });
  }

  private determineVisibility(
    badge: BadgeDefinitionRow,
    progress: Record<string, unknown> | null,
  ): ProgressVisibility {
    if (badge.isHidden) {
      if (progress && (progress.current as number) > 0) {
        return ProgressVisibility.CONDITIONAL;
      }
      return ProgressVisibility.HIDDEN;
    }

    return ProgressVisibility.VISIBLE;
  }

  private async resolveCurrentProgress(
    userId: string,
    badgeId: string,
    config: Record<string, unknown> | null,
    target: number,
  ): Promise<number> {
    const hasBadge = await this.achievementRepository.hasBadge(userId, badgeId);
    if (hasBadge) {
      return target;
    }

    const storedProgress = await this.achievementRepository.getBadgeProgress(userId, badgeId);
    const storedCurrent = this.getNumericValue(storedProgress?.current);
    if (storedCurrent !== null) {
      return this.clampValue(storedCurrent, 0, target);
    }

    const metric = typeof config?.metric === 'string' ? config.metric : null;
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    const badgeTypeSlug = badge?.slug ?? null;

    if (
      metric === 'streak_days' ||
      metric === 'current_streak' ||
      metric === 'longest_streak' ||
      (badgeTypeSlug !== null && STREAK_BADGE_TARGETS.some((entry) => entry.type === badgeTypeSlug))
    ) {
      return this.inferStreakCurrent(userId, badgeId, badgeTypeSlug);
    }

    if (metric === 'current_rank' || metric === 'period_rank' || metric === 'all_time_rank') {
      return 0;
    }

    return 0;
  }

  private resolveTarget(config: Record<string, unknown> | null, badgeId: string): number {
    const configuredTarget = this.getNumericValue(config?.threshold);
    if (configuredTarget !== null && configuredTarget > 0) {
      return configuredTarget;
    }

    const badgeTarget = this.inferBadgeTarget(badgeId);
    if (badgeTarget > 0) {
      return badgeTarget;
    }

    return 1;
  }

  private inferBadgeTarget(badgeId: string): number {
    switch (badgeId as BadgeType) {
      case BadgeType.RANK_1:
        return BADGE_THRESHOLDS.RANK.RANK_1;
      case BadgeType.TOP_10:
        return BADGE_THRESHOLDS.RANK.TOP_10;
      case BadgeType.TOP_100:
        return BADGE_THRESHOLDS.RANK.TOP_100;
      case BadgeType.TOP_1000:
        return BADGE_THRESHOLDS.RANK.TOP_1000;
      case BadgeType.STREAK_7:
        return BADGE_THRESHOLDS.STREAK.STREAK_7;
      case BadgeType.STREAK_30:
        return BADGE_THRESHOLDS.STREAK.STREAK_30;
      case BadgeType.STREAK_100:
        return BADGE_THRESHOLDS.STREAK.STREAK_100;
      default:
        return 1;
    }
  }

  private async inferStreakCurrent(
    userId: string,
    _badgeId: string,
    badgeTypeSlug: string | null,
  ): Promise<number> {
    if (badgeTypeSlug === null) {
      return 0;
    }

    const targetEntry = STREAK_BADGE_TARGETS.find((entry) => entry.type === badgeTypeSlug);
    if (!targetEntry) {
      return 0;
    }

    const storedProgress = await this.achievementRepository.getBadgeProgress(userId, badgeTypeSlug);
    const storedDays =
      this.getNumericValue(storedProgress?.longestStreak) ??
      this.getNumericValue(storedProgress?.currentStreak);
    if (storedDays !== null) {
      return Math.min(storedDays, targetEntry.days);
    }

    return 0;
  }

  private calculatePercent(current: number, target: number): number {
    if (target <= 0) {
      return 0;
    }

    const rawPercent = Math.floor((current / target) * 100);
    return this.clampValue(rawPercent, 0, 100);
  }

  private getNumericValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private clampValue(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
