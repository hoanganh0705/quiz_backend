/**
 * Shared Achievement Events
 *
 * Cross-module event types for Achievement domain events consumed by other modules.
 * These event definitions are the canonical contract — consumers import from here,
 * not from the Achievement module internals.
 *
 * The Achievement module re-exports these types and provides an implementation of
 * SharedAchievementEventBusPort so consumers (notably Social's feed listener) can
 * subscribe without depending on Achievement module internals.
 *
 * The event payload is intentionally wider than the internal `badge.earned` type
 * (which uses a strict union for `badgeType`) so the shared contract can carry
 * any badge type the Achievement module chooses to introduce.
 */

import type {
  AchievementAwardedEvent,
  BadgeEarnedEvent,
  BadgeRevokedEvent,
  StreakMilestoneEvent,
} from '@/modules/achievement/domain/events/achievement.events';

/**
 * Public-shape badge.earned event. Mirrors the internal type but exposes
 * `badgeType` as a plain string to keep the cross-module contract loose.
 */
export interface SharedBadgeEarnedEvent {
  readonly eventType: 'badge.earned';
  readonly userId: string;
  readonly badgeType: string;
  readonly awardedAt: Date;
}

/**
 * Public-shape badge.revoked event.
 */
export interface SharedBadgeRevokedEvent {
  readonly eventType: 'badge.revoked';
  readonly userId: string;
  readonly badgeId: string;
  readonly badgeType: string;
  readonly revokedAt: Date;
  readonly reason: string;
  readonly revokedBy: string;
}

/**
 * Public-shape achievement.awarded event. Re-emitted verbatim from the internal bus.
 */
export type SharedAchievementAwardedEvent = AchievementAwardedEvent;

/**
 * Public-shape streak.milestone event. Re-emitted verbatim from the internal bus.
 */
export type SharedStreakMilestoneEvent = StreakMilestoneEvent;

/**
 * Union type of all Achievement events consumed by other modules.
 *
 * Internal events (e.g. internal rule-engine evaluation hints) are NOT included
 * here — those stay inside the Achievement module.
 */
export type SharedAchievementDomainEvent =
  | SharedAchievementAwardedEvent
  | SharedBadgeEarnedEvent
  | SharedBadgeRevokedEvent
  | SharedStreakMilestoneEvent;

/**
 * Re-export of the internal BadgeEarnedEvent for the shared adapter only.
 * Consumers should prefer SharedBadgeEarnedEvent.
 */
export type InternalBadgeEarnedEvent = BadgeEarnedEvent;
export type InternalBadgeRevokedEvent = BadgeRevokedEvent;

/**
 * Event bus port for cross-module Achievement events.
 *
 * Consumers inject this port to subscribe to Achievement events.
 * The Achievement module provides the implementation via SharedAchievementEventBusAdapter.
 */
export interface SharedAchievementEventBusPort {
  /**
   * Subscribe to Achievement domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: SharedAchievementDomainEvent) => void): () => void;
}

export const SHARED_ACHIEVEMENT_EVENT_BUS = Symbol('SHARED_ACHIEVEMENT_EVENT_BUS');
