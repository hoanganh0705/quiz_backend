/**
 * User Activity Service
 *
 * Handles recording and querying user activity events.
 * Consumes events from the AchievementDomainEventBus to build a public activity timeline.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { activityEventType, userActivityEvents } from '@/core/database/schema';

type ActivityEventTypeValue = (typeof activityEventType.enumValues)[number];

const ACTIVITY_TYPE_MAP: Record<string, ActivityEventTypeValue> = {
  'achievement.awarded': 'achievement_awarded',
  'badge.earned': 'achievement_awarded',
  'attempt.completed': 'attempt_completed',
  'tournament.joined': 'tournament_joined',
  'tournament.completed': 'tournament_completed',
  'tournament.won': 'tournament_won',
  'rank.improved': 'rank_improved',
  'rank.milestone': 'rank_milestone',
  'streak.milestone': 'streak_milestone',
};

const VISIBLE_EVENT_TYPES = new Set([
  'achievement.awarded',
  'badge.earned',
  'attempt.completed',
  'tournament.joined',
  'tournament.completed',
  'tournament.won',
  'rank.improved',
  'rank.milestone',
  'streak.milestone',
]);

export const USER_ACTIVITY_SERVICE = Symbol('USER_ACTIVITY_SERVICE');

export interface UserActivityService {
  recordExternalEvent(params: {
    eventType: string;
    userId: string;
    metadata?: Record<string, unknown>;
    occurredAt: Date;
  }): Promise<void>;
}

@Injectable()
export class UserActivityServiceImpl implements UserActivityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(UserActivityServiceImpl.name) private readonly logger: PinoLogger,
  ) {}

  async recordExternalEvent(params: {
    eventType: string;
    userId: string;
    metadata?: Record<string, unknown>;
    occurredAt: Date;
  }): Promise<void> {
    if (!VISIBLE_EVENT_TYPES.has(params.eventType)) {
      return;
    }

    const activityEventTypeValue = ACTIVITY_TYPE_MAP[params.eventType] ?? 'attempt_completed';

    try {
      await this.db.insert(userActivityEvents).values({
        userId: params.userId,
        eventType: activityEventTypeValue,
        metadata: params.metadata ?? {},
        visibility: 'public' as const,
        occurredAt: params.occurredAt.toISOString(),
        createdAt: new Date().toISOString(),
      });

      this.logger.debug({
        event: 'activity_event_recorded',
        eventType: params.eventType,
        userId: params.userId,
      });
    } catch (error) {
      this.logger.error({
        event: 'activity_event_recording_failed',
        eventType: params.eventType,
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
