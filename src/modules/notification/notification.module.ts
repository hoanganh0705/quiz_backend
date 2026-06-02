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
  SocialNotificationService,
} from './domain/services';
import {
  RankingListenerAdapter,
  AchievementListenerAdapter,
  TournamentListenerAdapter,
  SocialListenerAdapter,
  SocialEventHandler,
} from './infrastructure/adapters';
import { RankingModule } from '@/modules/ranking';
import { SocialModule } from '@/modules/social';

@Module({
  imports: [DatabaseModule, RankingModule, SocialModule],
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
    SocialNotificationService,

    // Infrastructure - Event Listeners
    RankingListenerAdapter,
    AchievementListenerAdapter,
    TournamentListenerAdapter,
    SocialListenerAdapter,
    SocialEventHandler,

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
    SocialNotificationService,

    // Application
    NotificationApplicationService,
  ],
})
export class NotificationModule {}
