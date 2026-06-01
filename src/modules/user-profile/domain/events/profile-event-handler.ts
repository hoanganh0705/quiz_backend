/**
 * Profile Event Handler
 *
 * Handles events from other domains and records them in the activity timeline.
 * Also handles internal profile events for cache invalidation.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ActivityTimelineService } from '../services/activity-timeline.service';
import type {
  ExternalDomainEvent,
  ExternalToProfileEventBusPort,
} from '../ports/profile-event-bus.port';
import { EXTERNAL_TO_PROFILE_EVENT_BUS } from '../ports/profile-event-bus.port';
import { ActivityEventType } from '../types/profile.types';

/**
 * Maps external event types to profile activity event types.
 */
const EXTERNAL_TO_ACTIVITY_TYPE_MAP: Record<string, ActivityEventType | null> = {
  'attempt.completed': ActivityEventType.ATTEMPT_COMPLETED,
  'achievement.awarded': ActivityEventType.ACHIEVEMENT_AWARDED,
  'badge.earned': ActivityEventType.ACHIEVEMENT_AWARDED,
  'tournament.joined': ActivityEventType.TOURNAMENT_JOINED,
  'tournament.completed': ActivityEventType.TOURNAMENT_COMPLETED,
  'tournament.won': ActivityEventType.TOURNAMENT_WON,
  'rank.improved': ActivityEventType.RANK_IMPROVED,
  'rank.milestone': ActivityEventType.RANK_MILESTONE,
  'streak.milestone': ActivityEventType.STREAK_MILESTONE,
};

/**
 * Maps external events to structured metadata (facts only, no presentation).
 */
const EVENT_METADATA_TRANSFORMERS: Record<
  string,
  (event: ExternalDomainEvent) => Record<string, unknown>
> = {
  'attempt.completed': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'attempt.completed' }>;
    return {
      attemptId: ev.attemptId,
      quizId: ev.quizId,
      scorePercent: ev.scorePercent,
      xpEarned: ev.xpEarned,
      correctCount: ev.correctCount,
      totalQuestions: ev.totalQuestions,
    };
  },
  'achievement.awarded': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'achievement.awarded' }>;
    return {
      badgeType: ev.badgeType,
      achievementType: ev.achievementType,
    };
  },
  'badge.earned': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'badge.earned' }>;
    return {
      badgeId: ev.badgeId,
    };
  },
  'tournament.joined': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.joined' }>;
    return {
      tournamentId: ev.tournamentId,
    };
  },
  'tournament.completed': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.completed' }>;
    return {
      tournamentId: ev.tournamentId,
      finalRank: ev.rank,
      totalParticipants: ev.totalParticipants,
    };
  },
  'tournament.won': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.won' }>;
    return {
      tournamentId: ev.tournamentId,
      prize: ev.prize,
    };
  },
  'rank.improved': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.improved' }>;
    return {
      newRank: ev.newRank,
      previousRank: ev.previousRank,
      period: ev.period,
    };
  },
  'rank.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.milestone' }>;
    return {
      rank:
        ev.milestoneType === 'rank1'
          ? 1
          : ev.milestoneType === 'top10'
            ? 10
            : ev.milestoneType === 'top100'
              ? 100
              : 1000,
      period: ev.period,
    };
  },
  'streak.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'streak.milestone' }>;
    return {
      streakDays: ev.streakDays,
      streakType: 'current',
      previousStreak: ev.previousStreak,
    };
  },
};

@Injectable()
export class ProfileEventHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private readonly timelineService: ActivityTimelineService,
    @Inject(EXTERNAL_TO_PROFILE_EVENT_BUS)
    private readonly externalEventBus: ExternalToProfileEventBusPort,
    @InjectPinoLogger(ProfileEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribeToExternalEvents();
    this.logger.info({
      event: 'profile_event_handler_initialized',
    });
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.logger.info({
      event: 'profile_event_handler_destroyed',
    });
  }

  private subscribeToExternalEvents(): void {
    const eventTypes = Object.keys(EXTERNAL_TO_ACTIVITY_TYPE_MAP);

    for (const eventType of eventTypes) {
      const unsubscribe = this.externalEventBus.subscribe(
        eventType,
        this.handleExternalEvent.bind(this),
      );
      this.unsubscribers.push(unsubscribe);
    }

    this.logger.info({
      event: 'subscribed_to_external_events',
      eventTypes,
    });
  }

  private async handleExternalEvent(event: ExternalDomainEvent): Promise<void> {
    const activityType = EXTERNAL_TO_ACTIVITY_TYPE_MAP[event.eventType];

    if (activityType === null) {
      return;
    }

    this.logger.debug({
      event: 'external_event_received',
      eventType: event.eventType,
      userId: event.userId,
    });

    try {
      await this.timelineService.recordEvent({
        userId: event.userId,
        eventType: activityType,
        metadata: EVENT_METADATA_TRANSFORMERS[event.eventType]?.(event),
        visibility: 'public',
        occurredAt: 'timestamp' in event ? event.timestamp : event.awardedAt,
      });

      this.logger.debug({
        event: 'activity_event_recorded',
        eventType: event.eventType,
        userId: event.userId,
        activityType,
      });
    } catch (error) {
      this.logger.error({
        event: 'activity_event_recording_failed',
        eventType: event.eventType,
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
