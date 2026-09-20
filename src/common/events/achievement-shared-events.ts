import type {
  AchievementAwardedEvent,
  BadgeEarnedEvent,
  BadgeRestoredEvent,
  BadgeRevokedEvent,
  StreakMilestoneEvent,
} from '@/modules/achievement/domain/events/achievement.events';

export interface SharedBadgeEarnedEvent {
  readonly eventType: 'badge.earned';
  readonly userId: string;
  readonly badgeType: string;
  readonly awardedAt: Date;
}

export interface SharedBadgeRevokedEvent {
  readonly eventType: 'badge.revoked';
  readonly userId: string;
  readonly badgeId: string;
  readonly badgeType: string;
  readonly revokedAt: Date;
  readonly reason: string;
  readonly revokedBy: string;
}

export interface SharedBadgeRestoredEvent {
  readonly eventType: 'badge.restored';
  readonly userId: string;
  readonly badgeId: string;
  readonly badgeType: string;
  readonly restoredAt: Date;
  readonly restoredBy: string;
}

export type SharedAchievementAwardedEvent = AchievementAwardedEvent;

export type SharedStreakMilestoneEvent = StreakMilestoneEvent;

export type SharedAchievementDomainEvent =
  | SharedAchievementAwardedEvent
  | SharedBadgeEarnedEvent
  | SharedBadgeRevokedEvent
  | SharedBadgeRestoredEvent
  | SharedStreakMilestoneEvent;

export type InternalBadgeEarnedEvent = BadgeEarnedEvent;
export type InternalBadgeRevokedEvent = BadgeRevokedEvent;
export type InternalBadgeRestoredEvent = BadgeRestoredEvent;

export interface SharedAchievementEventBusPort {
  subscribe(handler: (event: SharedAchievementDomainEvent) => void): () => void;
}

export const SHARED_ACHIEVEMENT_EVENT_BUS = Symbol('SHARED_ACHIEVEMENT_EVENT_BUS');
