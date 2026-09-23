import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  UserProfileUpdatedEvent,
  UserSettingsUpdatedEvent,
  UserStreakUpdatedEvent,
} from './user-domain.events';
import type { UserDomainEventBusPort } from './user-domain-event-bus.port';

export type UserDomainEvent =
  | UserProfileUpdatedEvent
  | UserSettingsUpdatedEvent
  | UserStreakUpdatedEvent;

@Injectable()
export class UserDomainEventBus
  extends BaseDomainEventBus<UserDomainEvent>
  implements UserDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(UserDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'user_event' });
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
