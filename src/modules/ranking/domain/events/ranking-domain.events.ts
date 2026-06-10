/**
 * Ranking Domain Events
 *
 * Defines all events emitted by the Ranking Domain.
 */

import { RankingPeriod, RankingMilestone } from '../types/ranking.types';

// Re-export ExternalXpEarnedEvent from the shared common location
export type { ExternalXpEarnedEvent } from '@/common/events';

/**
 * Event emitted when XP is successfully added to a user's ranking.
 */
export interface XpAddedEvent {
  readonly eventType: 'xp.added';
  readonly userId: string;
  readonly amount: number;
  readonly newAllTimeXp: number;
  readonly newWeeklyXp: number;
  readonly newMonthlyXp: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a user's rank changes.
 */
export interface RankChangedEvent {
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
export interface PeakRankAchievedEvent {
  readonly eventType: 'peak.rank.achieved';
  readonly userId: string;
  readonly period: RankingPeriod;
  readonly previousPeakRank: number | null;
  readonly newPeakRank: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a period reset is initiated.
 */
export interface PeriodResetInitiatedEvent {
  readonly eventType: 'period.reset.initiated';
  readonly period: RankingPeriod;
  readonly resetAt: Date;
  readonly usersAffected: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when a period reset is completed.
 */
export interface PeriodResetCompletedEvent {
  readonly eventType: 'period.reset.completed';
  readonly period: RankingPeriod;
  readonly previousPeriodEnd: Date;
  readonly archivedRecords: number;
  readonly newPeriodStart: Date;
  readonly timestamp: Date;
}

/**
 * Event emitted when a ranking milestone is reached.
 */
export interface RankingMilestoneEvent {
  readonly eventType: 'ranking.milestone';
  readonly userId: string;
  readonly period: RankingPeriod;
  readonly milestoneType: RankingMilestone;
  readonly rank: number;
  readonly percentile: number;
  readonly timestamp: Date;
}

/**
 * Event emitted when consistency check finds issues.
 */
export interface ConsistencyCheckEvent {
  readonly eventType: 'consistency.check';
  readonly issuesFound: number;
  readonly issuesFixed: number;
  readonly timestamp: Date;
}

/**
 * Union type of all ranking domain events.
 */
export type RankingDomainEvent =
  | XpAddedEvent
  | RankChangedEvent
  | PeakRankAchievedEvent
  | PeriodResetInitiatedEvent
  | PeriodResetCompletedEvent
  | RankingMilestoneEvent
  | ConsistencyCheckEvent;
