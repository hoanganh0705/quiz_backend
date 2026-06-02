import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationApplicationService } from './application/notification-application.service';
import { NotificationService } from './domain/notification.service';
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY_PORT,
} from './infrastructure/repositories/notification.repository';
import { NotificationController } from './transport/controller/notification.controller';
import {
  NotificationChannelService,
  RankNotificationService,
  AchievementNotificationService,
  TournamentNotificationService,
} from './domain/services';
import {
  RankingListenerAdapter,
  AchievementListenerAdapter,
  TournamentListenerAdapter,
} from './infrastructure/adapters';
import { RankingModule } from '@/modules/ranking';

@Module({
  imports: [DatabaseModule, RankingModule],
  providers: [
    // Infrastructure - Repository
    NotificationRepository,
    {
      provide: NOTIFICATION_REPOSITORY_PORT,
      useExisting: NotificationRepository,
    },

    // Domain Services
    NotificationService,
    NotificationChannelService,
    RankNotificationService,
    AchievementNotificationService,
    TournamentNotificationService,

    // Infrastructure - Event Listeners
    RankingListenerAdapter,
    AchievementListenerAdapter,
    TournamentListenerAdapter,

    // Application
    NotificationApplicationService,
  ],
  controllers: [NotificationController],
  exports: [
    // Ports
    NOTIFICATION_REPOSITORY_PORT,

    // Domain Services
    NotificationService,
    NotificationChannelService,
    RankNotificationService,
    AchievementNotificationService,
    TournamentNotificationService,

    // Application
    NotificationApplicationService,
  ],
})
export class NotificationModule {}
