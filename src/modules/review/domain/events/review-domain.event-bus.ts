import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  ReviewDomainEventBusPort,
  PublishedReviewDomainEvent,
} from './review-domain-event-bus.port';

@Injectable()
export class ReviewDomainEventBus
  extends BaseDomainEventBus<PublishedReviewDomainEvent>
  implements ReviewDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(ReviewDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'review_event' });
  }

  subscribe(handler: (event: PublishedReviewDomainEvent) => void): () => void {
    return super.subscribe(handler);
  }

  dispatchToSubscribers(event: PublishedReviewDomainEvent): void {
    super.dispatchToSubscribers(event);
  }
}
