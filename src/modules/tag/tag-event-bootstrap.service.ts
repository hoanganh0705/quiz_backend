import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TAG_DOMAIN_EVENT_BUS,
  type TagDomainEventBusPort,
} from './domain/events/tag-domain-event-bus.port';
import type {
  TagCreatedEvent,
  TagUpdatedEvent,
  TagDeletedEvent,
  TagRestoredEvent,
  TagFollowedEvent,
  TagUnfollowedEvent,
} from './domain/events/tag-domain.events';

/**
 * Wires TagDomainEventBus events to observability sinks.
 *
 * Tag analytics are computed on-demand from `tags`, `quizTags`, and `quizStats`
 * (see QuizAnalyticsService.getTagAnalytics) so no materialized state needs
 * invalidation on tag lifecycle events. The service exists to provide a single
 * subscription point that the rest of the system can extend without coupling
 * to TagDomainService.
 *
 * The follow/unfollow events currently have no derived state to refresh, but
 * subscribing ensures future side effects (cache invalidation, notification
 * dispatch, social-feed updates) can be added here without changing publishers.
 */
@Injectable()
export class TagEventBootstrapService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(TAG_DOMAIN_EVENT_BUS)
    private readonly tagEventBus: TagDomainEventBusPort,
    @InjectPinoLogger(TagEventBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.tagEventBus.subscribe((event) => {
      this.handleEvent(event);
    });

    this.logger.info({ event: 'tag_event_subscriptions_initialized' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private handleEvent(event: unknown): void {
    if (this.isTagCreatedEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_created',
        tagId: event.tagId,
        slug: event.slug,
      });
      return;
    }
    if (this.isTagUpdatedEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_updated',
        tagId: event.tagId,
      });
      return;
    }
    if (this.isTagDeletedEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_deleted',
        tagId: event.tagId,
      });
      return;
    }
    if (this.isTagRestoredEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_restored',
        tagId: event.tagId,
      });
      return;
    }
    if (this.isTagFollowedEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_followed',
        tagId: event.tagId,
        userId: event.userId,
      });
      return;
    }
    if (this.isTagUnfollowedEvent(event)) {
      this.logger.info({
        event: 'tag_event_bootstrap_unfollowed',
        tagId: event.tagId,
        userId: event.userId,
      });
      return;
    }
  }

  private isTagCreatedEvent(event: unknown): event is TagCreatedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.created'
    );
  }

  private isTagUpdatedEvent(event: unknown): event is TagUpdatedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.updated'
    );
  }

  private isTagDeletedEvent(event: unknown): event is TagDeletedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.deleted'
    );
  }

  private isTagRestoredEvent(event: unknown): event is TagRestoredEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.restored'
    );
  }

  private isTagFollowedEvent(event: unknown): event is TagFollowedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.followed'
    );
  }

  private isTagUnfollowedEvent(event: unknown): event is TagUnfollowedEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'tag.unfollowed'
    );
  }
}
