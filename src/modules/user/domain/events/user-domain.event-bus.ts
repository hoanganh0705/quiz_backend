import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  UserProfileUpdatedEvent,
  UserSettingsUpdatedEvent,
  UserStreakUpdatedEvent,
} from './user-domain.events';
import type { UserDomainEventBusPort } from './user-domain-event-bus.port';
import { TracingProvider } from '@/core/observability/tracing.provider';

export type UserDomainEvent =
  UserProfileUpdatedEvent | UserSettingsUpdatedEvent | UserStreakUpdatedEvent;

@Injectable()
export class UserDomainEventBus
  extends BaseDomainEventBus<UserDomainEvent>
  implements UserDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(UserDomainEventBus.name)
    logger: PinoLogger,
    @Optional()
    @Inject(TracingProvider)
    tracing?: TracingProvider,
  ) {
    super(logger, { logEventName: 'user_event' }, tracing);
  }

  emitProfileUpdated(event: UserProfileUpdatedEvent): void {
    this.dispatch(event);
  }

  emitSettingsUpdated(event: UserSettingsUpdatedEvent): void {
    this.dispatch(event);
  }

  emitStreakUpdated(event: UserStreakUpdatedEvent): void {
    this.dispatch(event);
  }
}
