/**
 * Achievement Domain Events
 */

export interface AchievementAwardedEvent {
  readonly eventType: 'achievement.awarded';
  readonly userId: string;
  readonly achievementType: string;
  readonly badgeType: string;
  readonly period?: string;
  readonly rank?: number;
  readonly timestamp: Date;
}

export interface BadgeEarnedEvent {
  readonly eventType: 'badge.earned';
  readonly userId: string;
  readonly badgeType: 'rising_star' | 'veteran' | 'newcomer' | 'top10' | 'top100' | 'top1000';
  readonly awardedAt: Date;
}

export interface BadgeRevokedEvent {
  readonly eventType: 'badge.revoked';
  readonly userId: string;
  readonly badgeId: string;
  readonly badgeType: string;
  readonly revokedAt: Date;
  readonly reason: string;
  readonly revokedBy: string;
}

export interface StreakMilestoneEvent {
  readonly eventType: 'streak.milestone';
  readonly userId: string;
  readonly streakDays: number;
  readonly timestamp: Date;
}

export type AchievementDomainEvent =
  | AchievementAwardedEvent
  | BadgeEarnedEvent
  | BadgeRevokedEvent
  | StreakMilestoneEvent;
