/**
 * Shared Ranking Events
 *
 * Cross-module event types for Ranking domain events consumed by other modules.
 * These event definitions are the canonical contract — consumers import from here,
 * not from the Ranking module internals.
 *
 * The Ranking module re-exports these types and provides an implementation of
 * SharedRankingEventBusPort so consumers can subscribe without depending on
 * Ranking module internals.
 */

import { RankingPeriod, RankingMilestone } from '@/modules/ranking/domain/types/ranking.types';

/**
 * Event emitted when a user's rank changes.
 */
export interface SharedRankChangedEvent {
  readonly eventType: 'rank.changed';
  readonly userId: string;
  readonly period: RankingPeriod;
  readonly previousRank: number | null;
  readonly newRank: number;
  readonly previousXp: number;
  readonly newXp: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a user's peak rank is beaten.
 */
export interface SharedPeakRankAchievedEvent {
  readonly eventType: 'peak.rank.achieved';
  readonly userId: string;
  readonly period: RankingPeriod;
  readonly previousPeakRank: number | null;
  readonly newPeakRank: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a ranking milestone is reached.
 */
export interface SharedRankingMilestoneEvent {
  readonly eventType: 'ranking.milestone';
  readonly userId: string;
  readonly period: RankingPeriod;
  readonly milestoneType: RankingMilestone;
  readonly rank: number;
  readonly percentile: number;
  readonly timestamp: Date;
}

/**
 * Union type of all Ranking events consumed by other modules.
 * Internal-only events (xp.added, period resets, consistency checks) are excluded.
 */
export type SharedRankingDomainEvent =
  | SharedRankChangedEvent
  | SharedPeakRankAchievedEvent
  | SharedRankingMilestoneEvent;

/**
 * Event bus port for cross-module Ranking events.
 *
 * Consumers inject this port to subscribe to Ranking events.
 * The Ranking module provides the implementation via SharedRankingEventBusAdapter.
 */
export interface SharedRankingEventBusPort {
  /**
   * Subscribe to Ranking domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: SharedRankingDomainEvent) => void): () => void;
}

export const SHARED_RANKING_EVENT_BUS = Symbol('SHARED_RANKING_EVENT_BUS');
