import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  ReviewDomainEventBusPort,
  PublishedReviewDomainEvent,
} from './review-domain-event-bus.port';
import { TracingProvider } from '@/core/observability/tracing.provider';

@Injectable()
export class ReviewDomainEventBus
  extends BaseDomainEventBus<PublishedReviewDomainEvent>
  implements ReviewDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(ReviewDomainEventBus.name)
    logger: PinoLogger,
    @Optional()
    @Inject(TracingProvider)
    tracing?: TracingProvider,
  ) {
    super(logger, { logEventName: 'review_event' }, tracing);
  }

  subscribe(handler: (event: PublishedReviewDomainEvent) => void): () => void {
    return super.subscribe(handler);
  }

  dispatchToSubscribers(event: PublishedReviewDomainEvent): void {
    super.dispatchToSubscribers(event);
  }

  async dispatchStrict(event: PublishedReviewDomainEvent): Promise<void> {
    await super.dispatchStrict(event);
  }
}
