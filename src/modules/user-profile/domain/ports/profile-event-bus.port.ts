/**
 * Profile Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to profile domain events.
 */

import type {
  ProfileInitializedEvent,
  ProfileUpdatedEvent,
  ProfileVisibilityChangedEvent,
} from '../events/profile.events';

/**
 * Event bus interface for profile domain.
 */
export interface ProfileDomainEventBusPort {
  /**
   * Subscribe to profile domain events.
   * Returns an unsubscribe function.
   */
  subscribe(handler: (event: ProfileDomainEvent) => void): () => void;

  /**
   * Publish a ProfileInitialized event.
   */
  emitProfileInitialized(event: ProfileInitializedEvent): void;

  /**
   * Publish a ProfileUpdated event.
   */
  emitProfileUpdated(event: ProfileUpdatedEvent): void;

  /**
   * Publish a ProfileVisibilityChanged event.
   */
  emitProfileVisibilityChanged(event: ProfileVisibilityChangedEvent): void;
}

/**
 * External event bus port for consuming events from other domains.
 */
export interface ExternalToProfileEventBusPort {
  /**
   * Subscribe to events from other domains.
   * Returns an unsubscribe function.
   */
  subscribe(eventType: string, handler: (event: ExternalDomainEvent) => void): () => void;
}

/**
 * Union type of external events that Profile domain subscribes to.
 */
export type ExternalDomainEvent =
  | {
      eventType: 'attempt.completed';
      userId: string;
      attemptId: string;
      quizId: string;
      quizTitle: string;
      scorePercent: number;
      correctCount: number;
      totalQuestions: number;
      xpEarned: number;
      timestamp: Date;
    }
  | {
      eventType: 'achievement.awarded';
      userId: string;
      achievementType: string;
      badgeType: string;
      period?: string;
      rank?: number;
      timestamp: Date;
    }
  | {
      eventType: 'badge.earned';
      userId: string;
      badgeType: string;
      badgeId: string;
      badgeName: string;
      awardedAt: Date;
    }
  | {
      eventType: 'tournament.joined';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      timestamp: Date;
    }
  | {
      eventType: 'tournament.completed';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      rank: number;
      totalParticipants: number;
      timestamp: Date;
    }
  | {
      eventType: 'tournament.won';
      userId: string;
      tournamentId: string;
      tournamentTitle: string;
      prize?: string;
      timestamp: Date;
    }
  | {
      eventType: 'rank.improved';
      userId: string;
      period: 'all_time' | 'weekly' | 'monthly';
      previousRank: number | null;
      newRank: number;
      xpAtChange: number;
      timestamp: Date;
    }
  | {
      eventType: 'rank.milestone';
      userId: string;
      period: 'all_time' | 'weekly' | 'monthly';
      milestoneType: 'top10' | 'top100' | 'top1000' | 'rank1';
      rank: number;
      percentile: number;
      timestamp: Date;
    }
  | {
      eventType: 'streak.milestone';
      userId: string;
      streakDays: number;
      previousStreak: number;
      timestamp: Date;
    };

/**
 * Union type of all profile domain events.
 */
export type ProfileDomainEvent =
  | ProfileInitializedEvent
  | ProfileUpdatedEvent
  | ProfileVisibilityChangedEvent;

export const PROFILE_DOMAIN_EVENT_BUS = Symbol('PROFILE_DOMAIN_EVENT_BUS');
export const EXTERNAL_TO_PROFILE_EVENT_BUS = Symbol('EXTERNAL_TO_PROFILE_EVENT_BUS');
