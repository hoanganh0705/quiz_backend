/**
 * Activity Timeline Service
 *
 * Handles activity timeline composition and event enrichment.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { ActivityEventRepositoryPort } from '../ports/profile-repository.port';
import type { ActivityEventRow } from '../types/profile.types';
import { ACTIVITY_EVENT_REPOSITORY_PORT } from '../ports/profile-repository.port';

@Injectable()
export class ActivityTimelineService {
  constructor(
    @Inject(ACTIVITY_EVENT_REPOSITORY_PORT)
    private readonly activityRepository: ActivityEventRepositoryPort,
    @InjectPinoLogger(ActivityTimelineService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get enriched activity timeline for a user.
   */
  async getTimeline(
    userId: string,
    params?: {
      limit?: number;
      offset?: number;
      includePrivate?: boolean;
      eventTypes?: string[];
    },
  ): Promise<ActivityEventRow[]> {
    const events = params?.eventTypes?.length
      ? await this.activityRepository.getEventsByType(userId, params.eventTypes as never, {
          limit: params.limit,
        })
      : await this.activityRepository.getTimeline(userId, {
          limit: params?.limit,
          offset: params?.offset,
          includePrivate: params?.includePrivate,
        });

    return events;
  }

  /**
   * Record a new activity event.
   */
  async recordEvent(params: {
    userId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
    visibility?: 'public' | 'private';
    occurredAt?: Date;
  }): Promise<ActivityEventRow> {
    this.logger.debug({
      event: 'activity_event_recorded',
      userId: params.userId,
      eventType: params.eventType,
    });

    return this.activityRepository.recordEvent({
      userId: params.userId,
      eventType: params.eventType as never,
      metadata: params.metadata,
      visibility: params.visibility,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Clean up old events.
   */
  async cleanupOldEvents(userId: string, daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deleted = await this.activityRepository.deleteOldEvents(userId, cutoffDate);

    if (deleted > 0) {
      this.logger.info({
        event: 'old_activity_events_deleted',
        userId,
        deleted,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    return deleted;
  }
}
