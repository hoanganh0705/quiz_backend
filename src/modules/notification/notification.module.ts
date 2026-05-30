/**
 * Notification Module
 *
 * Handles rank notifications, notification channels, and user preferences.
 */

import { Module } from '@nestjs/common';

// Domain
import { RankNotificationService } from './domain/services/rank-notification.service';
import { NotificationChannelService } from './domain/services/channel.service';

// Infrastructure
import { NotificationRepository } from './infrastructure/repositories/notification.repository.impl';
import { RankingListenerAdapter } from './infrastructure/adapters/ranking-listener.adapter';
import { NOTIFICATION_REPOSITORY_PORT } from './infrastructure/repositories/notification.repository';

// Application
import { NotificationApplicationService } from './application/notification.application.service';

@Module({
  providers: [
    // Domain Services
    RankNotificationService,
    NotificationChannelService,

    // Infrastructure
    NotificationRepository,
    RankingListenerAdapter,

    // Ports
    {
      provide: NOTIFICATION_REPOSITORY_PORT,
      useExisting: NotificationRepository,
    },

    // Application
    NotificationApplicationService,
  ],
  exports: [
    RankNotificationService,
    NotificationChannelService,
    NotificationApplicationService,
    NOTIFICATION_REPOSITORY_PORT,
  ],
})
export class NotificationModule {}
