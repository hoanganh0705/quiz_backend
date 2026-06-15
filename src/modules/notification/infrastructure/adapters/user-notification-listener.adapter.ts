/**
 * User Notification Listener
 *
 * Subscribes to User domain events and dispatches notifications via UserNotificationService.
 *
 * Registered in NotificationModule.onModuleInit and unsubscribed on destroy.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  USER_DOMAIN_EVENT_BUS,
  type UserDomainEvent,
  type UserProfileUpdatedEvent,
  type UserSettingsUpdatedEvent,
} from '@/modules/user/domain/events';
import { UserNotificationService } from '../../domain/services/user-notification.service';

@Injectable()
export class UserNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => USER_DOMAIN_EVENT_BUS))
    private readonly userEventBus: {
      subscribe(handler: (event: UserDomainEvent) => void): () => void;
    },
    private readonly userNotificationService: UserNotificationService,
    @InjectPinoLogger(UserNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): void {
    this.unsubscribe = this.userEventBus.subscribe((event: UserDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'user_notification_listener_subscribed',
    });
  }

  private async handleEvent(event: UserDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'user.profile.updated':
        await this.handleProfileUpdated(event);
        break;

      case 'user.settings.updated':
        await this.handleSettingsUpdated(event);
        break;
    }
  }

  private async handleProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    try {
      await this.userNotificationService.notifyProfileUpdated({
        userId: event.userId,
        changedFields: event.changedFields,
      });
    } catch (error) {
      this.logger.error({
        event: 'profile_updated_notification_failed',
        userId: event.userId,
        changedFields: event.changedFields,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleSettingsUpdated(event: UserSettingsUpdatedEvent): Promise<void> {
    try {
      await this.userNotificationService.notifySettingsUpdated({
        userId: event.userId,
      });
    } catch (error) {
      this.logger.error({
        event: 'settings_updated_notification_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
