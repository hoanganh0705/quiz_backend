import { Injectable } from '@nestjs/common';
import {
  type CategoryDomainEventBusPort,
  CATEGORY_DOMAIN_EVENT_BUS,
} from '../ports/category-domain-event-bus.port';

/**
 * Simple domain event bus for Category aggregate events.
 *
 * This is a lightweight in-process event bus using the observer pattern.
 * Events are dispatched synchronously within the same request lifecycle.
 */
@Injectable()
export class CategoryDomainEventBus implements CategoryDomainEventBusPort {
  private handlers: Array<(event: unknown) => void> = [];

  subscribe(handler: (event: unknown) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: unknown): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  emitCategoryCreated(event: { categoryId: string; slug: string; nowIso: string }): void {
    this.emit(event);
  }

  emitCategoryUpdated(event: { categoryId: string; slug: string; nowIso: string }): void {
    this.emit(event);
  }

  emitCategoryDeleted(event: { categoryId: string; slug: string; nowIso: string }): void {
    this.emit(event);
  }

  emitCategoryRestored(event: { categoryId: string; slug: string; nowIso: string }): void {
    this.emit(event);
  }
}

export { CATEGORY_DOMAIN_EVENT_BUS };
