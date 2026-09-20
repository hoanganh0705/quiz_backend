import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TAG_DOMAIN_EVENT_BUS,
  type TagDomainEventBusPort,
} from './domain/events/tag-domain-event-bus.port';
import type { TagDomainEvent } from './domain/events/tag-domain.events';

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
    if (!this.isTagDomainEvent(event)) return;

    switch (event.eventType) {
      case 'tag.created':
        this.logger.info({
          event: 'tag_event_bootstrap_created',
          tagId: event.tagId,
          slug: event.slug,
        });
        return;
      case 'tag.updated':
        this.logger.info({
          event: 'tag_event_bootstrap_updated',
          tagId: event.tagId,
        });
        return;
      case 'tag.deleted':
        this.logger.info({
          event: 'tag_event_bootstrap_deleted',
          tagId: event.tagId,
        });
        return;
      case 'tag.restored':
        this.logger.info({
          event: 'tag_event_bootstrap_restored',
          tagId: event.tagId,
        });
        return;
      case 'tag.followed':
        this.logger.info({
          event: 'tag_event_bootstrap_followed',
          tagId: event.tagId,
          userId: event.userId,
        });
        return;
      case 'tag.unfollowed':
        this.logger.info({
          event: 'tag_event_bootstrap_unfollowed',
          tagId: event.tagId,
          userId: event.userId,
        });
        return;
    }
  }

  private isTagDomainEvent(event: unknown): event is TagDomainEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      'eventType' in event &&
      typeof (event as { eventType: unknown }).eventType === 'string'
    );
  }
}
