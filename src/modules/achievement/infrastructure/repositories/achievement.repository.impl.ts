/**
 * Achievement Repository Implementation
 *
 * Stub implementation using in-memory storage.
 * Replace with actual database implementation when schema is ready.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AchievementRepositoryPort, type UserBadgeRow } from './achievement.repository';
import { BadgeType } from '../../domain/types/achievement.types';

@Injectable()
export class AchievementRepository implements AchievementRepositoryPort {
  private readonly badges = new Map<string, Map<BadgeType, UserBadgeRow>>();
  private readonly activityDays = new Map<string, Set<string>>();

  constructor(
    @InjectPinoLogger(AchievementRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  hasBadge(userId: string, badgeType: BadgeType): Promise<boolean> {
    const userBadges = this.badges.get(userId);
    return Promise.resolve(userBadges?.has(badgeType) ?? false);
  }

  awardBadge(params: {
    userId: string;
    badgeType: BadgeType;
    awardedAt: Date;
    metadata?: Record<string, unknown>;
  }): Promise<UserBadgeRow> {
    if (!this.badges.has(params.userId)) {
      this.badges.set(params.userId, new Map());
    }

    const userBadges = this.badges.get(params.userId)!;
    const badge: UserBadgeRow = {
      userId: params.userId,
      badgeType: params.badgeType,
      awardedAt: params.awardedAt,
      metadata: params.metadata,
    };

    userBadges.set(params.badgeType, badge);

    this.logger.info({
      event: 'badge_awarded',
      userId: params.userId,
      badgeType: params.badgeType,
    });

    return Promise.resolve(badge);
  }

  getUserBadges(userId: string): Promise<UserBadgeRow[]> {
    const userBadges = this.badges.get(userId);
    return Promise.resolve(userBadges ? Array.from(userBadges.values()) : []);
  }

  getUserStreak(userId: string): Promise<number> {
    const days = this.activityDays.get(userId);
    if (!days || days.size === 0) return Promise.resolve(0);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      if (days.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return Promise.resolve(streak);
  }

  recordActivity(userId: string, activityDate: Date): Promise<void> {
    if (!this.activityDays.has(userId)) {
      this.activityDays.set(userId, new Set());
    }

    const days = this.activityDays.get(userId)!;
    const dateStr = activityDate.toISOString().split('T')[0];
    days.add(dateStr);

    return Promise.resolve();
  }
}
