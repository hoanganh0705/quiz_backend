/**
 * External To Profile Event Bus Implementation
 *
 * Event bus for consuming events from other domains.
 * Implements the observer pattern for in-process event handling.
 */

import { Injectable } from '@nestjs/common';
import type { ExternalToProfileEventBusPort, ExternalDomainEvent } from '../ports/profile-event-bus.port';

type EventHandler = (event: ExternalDomainEvent) => void | Promise<void>;

@Injectable()
export class ExternalToProfileEventBus implements ExternalToProfileEventBusPort {
  private handlers: Map<string, Array<EventHandler>> = new Map();

  subscribe(eventType: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);

    return () => {
      const handlers = this.handlers.get(eventType) ?? [];
      const filtered = handlers.filter((h) => h !== handler);
      if (filtered.length > 0) {
        this.handlers.set(eventType, filtered);
      } else {
        this.handlers.delete(eventType);
      }
    };
  }

  async publish(event: ExternalDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in ${event.eventType} handler:`, error);
      }
    }
  }
}
