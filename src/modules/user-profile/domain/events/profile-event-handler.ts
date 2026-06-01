/**
 * Profile Event Handler
 *
 * Handles events from other domains and records them in the activity timeline.
 * Also handles internal profile events for cache invalidation.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ActivityTimelineService } from '../services/activity-timeline.service';
import { ActivityEventRepositoryPort, ACTIVITY_EVENT_REPOSITORY_PORT } from '../ports/profile-repository.port';
import {
  ExternalToProfileEventBusPort,
  EXTERNAL_TO_PROFILE_EVENT_BUS,
  type ExternalDomainEvent,
} from '../ports/profile-event-bus.port';
import type { ActivityEventType } from '../types/profile.types';

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
 * Maps external events to human-readable titles.
 */
const EVENT_TITLES: Record<string, (event: ExternalDomainEvent) => string> = {
  'attempt.completed': (e) => `Completed "${(e as Extract<ExternalDomainEvent, { eventType: 'attempt.completed' }>).quizTitle}"`,
  'achievement.awarded': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'achievement.awarded' }>;
    return `Earned ${ev.achievementType} achievement`;
  },
  'badge.earned': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'badge.earned' }>;
    return `Earned badge: ${ev.badgeName}`;
  },
  'tournament.joined': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.joined' }>;
    return `Joined tournament "${ev.tournamentTitle}"`;
  },
  'tournament.completed': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.completed' }>;
    return `Finished tournament "${ev.tournamentTitle}" at rank #${ev.rank}`;
  },
  'tournament.won': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.won' }>;
    return `Won tournament "${ev.tournamentTitle}"${ev.prize ? ` (${ev.prize})` : ''}`;
  },
  'rank.improved': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.improved' }>;
    const periodLabel = ev.period === 'all_time' ? 'global' : ev.period;
    return `Improved to rank #${ev.newRank} (${periodLabel})`;
  },
  'rank.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.milestone' }>;
    return `Reached ${ev.milestoneType.replace('top', 'Top ').replace('rank1', '#1')} on leaderboard!`;
  },
  'streak.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'streak.milestone' }>;
    return `Achieved ${ev.streakDays}-day activity streak!`;
  },
};

/**
 * Maps external events to descriptions.
 */
const EVENT_DESCRIPTIONS: Record<string, (event: ExternalDomainEvent) => string | undefined> = {
  'attempt.completed': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'attempt.completed' }>;
    return `Score: ${ev.scorePercent.toFixed(1)}% (${ev.correctCount}/${ev.totalQuestions} correct) • +${ev.xpEarned} XP`;
  },
  'achievement.awarded': () => undefined,
  'badge.earned': () => undefined,
  'tournament.joined': () => undefined,
  'tournament.completed': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'tournament.completed' }>;
    return `Ranked #${ev.rank} out of ${ev.totalParticipants} participants`;
  },
  'tournament.won': () => undefined,
  'rank.improved': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.improved' }>;
    if (ev.previousRank === null) {
      return `New rank achieved!`;
    }
    return `Moved up ${ev.previousRank - ev.newRank} positions`;
  },
  'rank.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'rank.milestone' }>;
    return `Top ${(100 - ev.percentile).toFixed(1)}% of all players`;
  },
  'streak.milestone': (e) => {
    const ev = e as Extract<ExternalDomainEvent, { eventType: 'streak.milestone' }>;
    return `Previous streak: ${ev.previousStreak} days`;
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
        title: EVENT_TITLES[event.eventType]?.(event) ?? event.eventType,
        description: EVENT_DESCRIPTIONS[event.eventType]?.(event),
        metadata: event as Record<string, unknown>,
        visibility: 'public',
        occurredAt: event.timestamp,
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
