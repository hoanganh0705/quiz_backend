import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { BaseEventHandler } from '@/common/events/base-domain-event-bus';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  TagCreatedEvent,
  TagUpdatedEvent,
  TagDeletedEvent,
  TagRestoredEvent,
  TagFollowedEvent,
  TagUnfollowedEvent,
} from './tag-domain.events';
import type { TagDomainEventBusPort } from './tag-domain-event-bus.port';
import { TracingProvider } from '@/core/observability/tracing.provider';

export type TagDomainEvent =
  | TagCreatedEvent
  | TagUpdatedEvent
  | TagDeletedEvent
  | TagRestoredEvent
  | TagFollowedEvent
  | TagUnfollowedEvent;

@Injectable()
export class TagDomainEventBus
  extends BaseDomainEventBus<TagDomainEvent>
  implements TagDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(TagDomainEventBus.name)
    logger: PinoLogger,
    @Optional()
    @Inject(TracingProvider)
    tracing?: TracingProvider,
  ) {
    super(logger, { logEventName: 'tag_event' }, tracing);
  }

  emitTagCreated(event: TagCreatedEvent): void {
    this.dispatch(event);
  }

  emitTagUpdated(event: TagUpdatedEvent): void {
    this.dispatch(event);
  }

  emitTagDeleted(event: TagDeletedEvent): void {
    this.dispatch(event);
  }

  emitTagRestored(event: TagRestoredEvent): void {
    this.dispatch(event);
  }

  emitTagFollowed(event: TagFollowedEvent): void {
    this.dispatch(event);
  }

  emitTagUnfollowed(event: TagUnfollowedEvent): void {
    this.dispatch(event);
  }

  override subscribe(handler: BaseEventHandler<TagDomainEvent>): () => void {
    return super.subscribe(handler);
  }
}
