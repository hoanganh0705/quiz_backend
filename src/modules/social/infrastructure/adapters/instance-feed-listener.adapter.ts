/**
 * Instance Feed Listener
 *
 * Subscribes to InstanceDomainEventBus to record key instance lifecycle events
 * in the social feed, enabling users to see their friends' real-time multiplayer
 * activity (instance creation, player join, instance completion).
 *
 * Only events that map to "public" multiplayer activity are recorded. Per-attempt
 * events (`player_attempt_started`, `player_finished`, `player_xp_earned`,
 * `player_disconnected`) are intentionally NOT mirrored to the social feed — they
 * are too noisy and the real-time socket layer (`InstanceApplicationService.emitToRoom`)
 * already covers the in-room UX.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { INSTANCE_DOMAIN_EVENT_BUS } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type { InstanceDomainEventBusPort } from '@/modules/instance/domain/events/instance-domain-event-bus.port';
import type {
  InstanceDomainEvent,
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  InstanceClosedEvent,
} from '@/modules/instance/domain/events/instance-domain.events';
import type { SocialFeedActivityType } from '../../domain/types/social.types';
import { SocialService } from '../../domain/services/social.service';

@Injectable()
export class InstanceFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(INSTANCE_DOMAIN_EVENT_BUS)
    private readonly instanceEventBus: InstanceDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(InstanceFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.instanceEventBus.subscribe((event: unknown) => {
      void this.handleEvent(event as InstanceDomainEvent);
    });

    this.logger.info({ event: 'instance_feed_listener_subscribed' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: InstanceDomainEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'instance.created':
          await this.recordInstanceCreated(event);
          break;
        case 'instance.player_joined':
          await this.recordPlayerJoined(event);
          break;
        case 'instance.closed':
          await this.recordInstanceClosed(event);
          break;
      }
    } catch (error) {
      this.logger.error({
        event: 'instance_feed_listener_handler_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async recordInstanceCreated(event: InstanceCreatedEvent): Promise<void> {
    await this.recordActivity({
      userId: event.hostUserId,
      activityType: 'instance_created',
      timestamp: event.timestamp,
      payload: {
        instanceId: event.instanceId,
        quizVersionId: event.quizVersionId,
        maxPlayers: event.maxPlayers,
      },
    });
  }

  private async recordPlayerJoined(event: PlayerJoinedEvent): Promise<void> {
    await this.recordActivity({
      userId: event.userId,
      activityType: 'instance_joined',
      timestamp: event.timestamp,
      payload: {
        instanceId: event.instanceId,
        totalPlayers: event.totalPlayers,
      },
    });
  }

  private async recordInstanceClosed(event: InstanceClosedEvent): Promise<void> {
    await this.recordActivity({
      userId: event.hostUserId,
      activityType: 'instance_completed',
      timestamp: event.timestamp,
      payload: {
        instanceId: event.instanceId,
      },
    });
  }

  private async recordActivity(params: {
    userId: string;
    activityType: SocialFeedActivityType;
    timestamp: Date;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.socialService.recordFeedActivity({
      userId: params.userId,
      activityType: params.activityType,
      occurredAt: params.timestamp.toISOString(),
      payload: params.payload,
    });

    this.logger.debug({
      event: 'instance_feed_activity_recorded',
      userId: params.userId,
      activityType: params.activityType,
    });
  }
}
