/**
 * Notification WebSocket Listener
 *
 * Subscribes to NotificationDomainEventBus lifecycle events (sent, read, unread, deleted)
 * and pushes them to connected WebSocket clients via NotificationGateway.
 *
 * Registered in NotificationModule as an @Injectable, so it can receive
 * NotificationGateway as a constructor dependency and subscribe on init.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  NOTIFICATION_DOMAIN_EVENT_BUS,
  type NotificationDomainEvent,
} from '@/modules/notification/domain/events';
import type { NotificationDomainEventBus, NotificationEventSubscription } from '@/modules/notification/domain/events/notification-domain.event-bus';
import { NotificationGateway } from '../../transport/gateway/notification.gateway';

@Injectable()
export class NotificationWebSocketListener implements OnModuleInit, OnModuleDestroy {
  private subscriptions: NotificationEventSubscription[] = [];

  constructor(
    @Inject(NOTIFICATION_DOMAIN_EVENT_BUS)
    private readonly notificationEventBus: NotificationDomainEventBus,
    private readonly notificationGateway: NotificationGateway,
    @InjectPinoLogger(NotificationWebSocketListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe();
  }

  private subscribe(): void {
    const eventTypes = [
      'notification.sent',
      'notification.read',
      'notification.unread',
      'notification.deleted',
    ] as const;

    for (const eventType of eventTypes) {
      const subscription = this.notificationEventBus.subscribe(eventType, (event: NotificationDomainEvent) => {
        void this.handleEvent(event);
      });

      this.subscriptions.push(subscription);
    }

    this.logger.info({
      event: 'notification_ws_listener_subscribed',
      eventTypes,
    });
  }

  private unsubscribe(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];

    this.logger.info({
      event: 'notification_ws_listener_unsubscribed',
    });
  }

  private handleEvent(event: NotificationDomainEvent): void {
    try {
      this.notificationGateway.pushToUser(event);
    } catch (error) {
      this.logger.error({
        event: 'notification_ws_push_failed',
        eventType: event.eventType,
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
