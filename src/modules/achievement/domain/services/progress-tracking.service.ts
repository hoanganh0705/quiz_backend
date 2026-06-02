/**
 * Progress Tracking Service
 *
 * Handles tracking progress toward achievements with support for:
 * - Visible progress: User can see exact progress (e.g., 7/10)
 * - Hidden progress: User cannot see progress until partial completion
 * - Conditional progress: Progress visible only after meeting conditions
 * - Incremental milestones: Progress increments toward next milestone
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { BadgeDefinitionRow } from '../../infrastructure/repositories/achievement.repository';

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

@Injectable()
export class ProgressTrackingService {
  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(ProgressTrackingService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get progress for a specific badge.
   */
  async getBadgeProgress(
    userId: string,
    badgeId: string,
  ): Promise<ProgressResponse | null> {
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

  /**
   * Get all progress for a user (visible badges only).
   */
  async getUserProgress(userId: string): Promise<ProgressResponse[]> {
    const badges = await this.achievementRepository.getAllActiveBadges();
    const results: ProgressResponse[] = [];

    for (const badge of badges) {
      // Skip hidden badges for general progress query
      if (badge.isHidden) continue;

      const hasBadge = await this.achievementRepository.hasBadge(userId, badge.badgeId);
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

      const storedProgress = await this.achievementRepository.getBadgeProgress(userId, badgeId);
      const visibility = this.determineVisibility(badge, storedProgress);

      // Only include if visibility allows showing
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

  /**
   * Update progress for a badge.
   */
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

    await this.achievementRepository.updateBadgeProgress(userId, badgeId, progress);

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

  /**
   * Increment progress for a badge.
   */
  async incrementProgress(
    userId: string,
    badgeId: string,
    increment: number = 1,
  ): Promise<ProgressUpdate | null> {
    const existingProgress = await this.achievementRepository.getBadgeProgress(userId, badgeId);

    if (!existingProgress) {
      // Need to determine target from badge rules - default to 1 for count-based
      const defaultTarget = 1;
      return this.updateProgress(userId, badgeId, increment, defaultTarget);
    }

    const current = (existingProgress.current as number) ?? 0;
    const target = (existingProgress.target as number) ?? 1;

    return this.updateProgress(userId, badgeId, current + increment, target);
  }

  /**
   * Reset progress for a badge (for recalculation).
   */
  async resetProgress(userId: string, badgeId: string): Promise<void> {
    await this.achievementRepository.updateBadgeProgress(userId, badgeId, {
      current: 0,
      target: 0,
      percentage: 0,
      lastUpdated: new Date(),
      isComplete: false,
    });
  }

  /**
   * Determine visibility based on badge config and current progress.
   */
  private determineVisibility(
    badge: BadgeDefinitionRow,
    progress: Record<string, unknown> | null,
  ): ProgressVisibility {
    // If badge is marked hidden in DB
    if (badge.isHidden) {
      // But if there's partial progress, it becomes conditional
      if (progress && (progress.current as number) > 0) {
        return ProgressVisibility.CONDITIONAL;
      }
      return ProgressVisibility.HIDDEN;
    }

    return ProgressVisibility.VISIBLE;
  }

  /**
   * Get milestones for a badge (for multi-step achievements).
   */
  async getMilestones(badgeId: string): Promise<number[]> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) return [];

    // Standard milestones: 10%, 25%, 50%, 75%, 100%
    // This could be extended with custom milestones in badge metadata
    return [10, 25, 50, 75, 100];
  }

  /**
   * Calculate progress for streak-based badges.
   */
  async calculateStreakProgress(userId: string, badgeId: string, streakDays: number): Promise<ProgressUpdate> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      return {
        current: streakDays,
        target: 0,
        percentage: 0,
        lastUpdated: new Date(),
        isComplete: false,
      };
    }

    // Target could be stored in badge metadata, default to milestones
    const targets = [7, 30, 100]; // Week, month, centurion
    let target = 1;

    for (const t of targets) {
      if (streakDays < t) {
        target = t;
        break;
      }
      target = t;
    }

    return {
      current: streakDays,
      target,
      percentage: target > 0 ? Math.min(100, Math.round((streakDays / target) * 100)) : 0,
      lastUpdated: new Date(),
      isComplete: streakDays >= target,
    };
  }

  /**
   * Calculate progress for rank-based badges.
   */
  async calculateRankProgress(userId: string, badgeId: string, currentRank: number): Promise<ProgressUpdate> {
    const badge = await this.achievementRepository.getBadgeById(badgeId);
    if (!badge) {
      return {
        current: 0,
        target: 0,
        percentage: 0,
        lastUpdated: new Date(),
        isComplete: false,
      };
    }

    // Target rank thresholds: 1, 10, 100, 1000
    const targets = [1, 10, 100, 1000];
    let target = 1000;

    for (const t of targets) {
      if (currentRank <= t) {
        target = t;
        break;
      }
    }

    // Progress is inverse - lower rank = more progress
    const percentage = target > 0 ? Math.max(0, Math.round(100 - (currentRank / target) * 100)) : 0;

    return {
      current: currentRank,
      target,
      percentage,
      lastUpdated: new Date(),
      isComplete: currentRank <= target,
    };
  }
}
