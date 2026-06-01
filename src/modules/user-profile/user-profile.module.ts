/**
 * User Profile Module
 *
 * Public-facing user profile: identity presentation, aggregated
 * statistics, activity timeline, and achievement showcase.
 *
 * Architecture:
 * - CQRS-lite: ProfileCommandService (write) + ProfileQueryService (read)
 * - Event-driven timeline: Consumes events from other domains
 * - Layered caching: Event invalidation + TTL fallback
 * - Privacy enforcement: Filtered based on settings and ownership
 */

import { Module } from '@nestjs/common';

import { ProfileQueryService } from './domain/services/profile-query.service';
import { ProfileCommandService } from './domain/services/profile-command.service';
import { ActivityTimelineService } from './domain/services/activity-timeline.service';
import { StatisticsAggregationService } from './domain/services/statistics-aggregation.service';
import { ProfileCacheService } from './domain/services/profile-cache.service';
import { ProfileDomainEventBus } from './domain/events/profile-domain.event-bus';
import { ExternalToProfileEventBus } from './domain/events/external-to-profile.event-bus';
import { ProfileEventHandler } from './domain/events/profile-event-handler';

@Module({
  providers: [
    // Core services
    ProfileQueryService,
    ProfileCommandService,
    ActivityTimelineService,
    StatisticsAggregationService,
    ProfileCacheService,
    // Event infrastructure
    ProfileDomainEventBus,
    ExternalToProfileEventBus,
    ProfileEventHandler,
  ],
  exports: [
    ProfileQueryService,
    ProfileCommandService,
    ActivityTimelineService,
    StatisticsAggregationService,
    ProfileCacheService,
    ProfileDomainEventBus,
    ExternalToProfileEventBus,
  ],
})
export class UserProfileModule {}
