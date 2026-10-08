import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import {
  type CategoryDomainEventBusPort,
  CATEGORY_DOMAIN_EVENT_BUS,
} from '../ports/category-domain-event-bus.port';
import { TracingProvider } from '@/core/observability/tracing.provider';

export interface CategoryDomainEvent {
  categoryId: string;
  slug: string;
  nowIso: string;
}

@Injectable()
export class CategoryDomainEventBus
  extends BaseDomainEventBus<CategoryDomainEvent>
  implements CategoryDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(CategoryDomainEventBus.name)
    logger: PinoLogger,
    @Optional()
    @Inject(TracingProvider)
    tracing?: TracingProvider,
  ) {
    super(logger, { logEventName: 'category_event' }, tracing);
  }

  emitCategoryCreated(event: CategoryDomainEvent): void {
    this.dispatch(event);
  }

  emitCategoryUpdated(event: CategoryDomainEvent): void {
    this.dispatch(event);
  }

  emitCategoryDeleted(event: CategoryDomainEvent): void {
    this.dispatch(event);
  }

  emitCategoryRestored(event: CategoryDomainEvent): void {
    this.dispatch(event);
  }
}

export { CATEGORY_DOMAIN_EVENT_BUS };
