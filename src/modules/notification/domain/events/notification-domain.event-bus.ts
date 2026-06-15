/**
 * Notification Domain Event Bus
 *
 * Publishes and subscribes to notification domain events.
 * Other domains can subscribe for WebSocket push, audit logging, etc.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { NotificationDomainEvent } from './notification.events';

export type NotificationEventHandler<T extends NotificationDomainEvent = NotificationDomainEvent> =
  (event: T) => void | Promise<void>;

export interface NotificationEventSubscription {
  unsubscribe: () => void;
}

@Injectable()
export class NotificationDomainEventBus {
  private handlers: Map<string, Set<NotificationEventHandler>> = new Map();
  private globalHandlers: Set<NotificationEventHandler> = new Set();

  constructor(
    @InjectPinoLogger(NotificationDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Subscribe to a specific notification event type.
   */
  subscribe<T extends NotificationDomainEvent>(
    eventType: T['eventType'],
    handler: NotificationEventHandler<T>,
  ): NotificationEventSubscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler as NotificationEventHandler);

    this.logger.debug({
      event: 'notification_event_subscription_created',
      eventType,
    });

    return {
      unsubscribe: () => {
        handlers.delete(handler as NotificationEventHandler);
        this.logger.debug({
          event: 'notification_event_subscription_removed',
          eventType,
        });
      },
    };
  }

  /**
   * Subscribe to all notification events.
   */
  subscribeAll(handler: NotificationEventHandler): NotificationEventSubscription {
    this.globalHandlers.add(handler);

    this.logger.debug({
      event: 'notification_global_event_subscription_created',
    });

    return {
      unsubscribe: () => {
        this.globalHandlers.delete(handler);
        this.logger.debug({
          event: 'notification_global_event_subscription_removed',
        });
      },
    };
  }

  /**
   * Publish a generic notification event.
   */
  emit(event: NotificationDomainEvent): void {
    this.publish(event);
  }

  /**
   * Internal publish method.
   */
  private publish(event: NotificationDomainEvent): void {
    this.logger.info({
      event: 'notification_event_published',
      eventType: event.eventType,
      notificationId: event.notificationId,
      userId: event.userId,
    });

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.logger.error({
              event: 'notification_event_handler_error',
              handler: 'global',
              eventType: event.eventType,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'notification_event_handler_error',
          handler: 'global',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error) => {
              this.logger.error({
                event: 'notification_event_handler_error',
                handler: event.eventType,
                eventType: event.eventType,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            });
          }
        } catch (error) {
          this.logger.error({
            event: 'notification_event_handler_error',
            handler: event.eventType,
            eventType: event.eventType,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
    this.logger.info({
      event: 'notification_event_bus_cleared',
    });
  }
}

export const NOTIFICATION_DOMAIN_EVENT_BUS = Symbol('NOTIFICATION_DOMAIN_EVENT_BUS');
