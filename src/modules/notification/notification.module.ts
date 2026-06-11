import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationApplicationService } from './application/notification-application.service';
import { NotificationService } from './domain/notification.service';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationController } from './transport/controller/notification.controller';
import {
  NotificationChannelService,
  RankNotificationService,
  AchievementNotificationService,
  TournamentNotificationService,
  SocialNotificationService,
  DiscussionNotificationService,
} from './domain/services';
import {
  NOTIFICATION_CHANNEL_SERVICE,
  NOTIFICATION_REPOSITORY_PORT,
} from './domain/ports';
import {
  RankingListenerAdapter,
  AchievementListenerAdapter,
  TournamentListenerAdapter,
  SocialListenerAdapter,
  SocialEventHandler,
  DiscussionListenerAdapter,
} from './infrastructure/adapters';
import { RankingModule } from '@/modules/ranking';
import { SocialModule } from '@/modules/social';
import { AchievementModule } from '@/modules/achievement/achievement.module';
import { TournamentModule } from '@/modules/tournament/tournament.module';
import { DiscussionModule } from '@/modules/discussion/discussion.module';

@Module({
  imports: [
    DatabaseModule,
    RankingModule,
    SocialModule,
    AchievementModule,
    TournamentModule,
    DiscussionModule,
    JwtModule,
  ],
  providers: [
    NotificationRepository,
    {
      provide: NOTIFICATION_REPOSITORY_PORT,
      useExisting: NotificationRepository,
    },
    NotificationService,
    {
      provide: NOTIFICATION_CHANNEL_SERVICE,
      useExisting: NotificationChannelService,
    },
    NotificationChannelService,
    RankNotificationService,
    AchievementNotificationService,
    TournamentNotificationService,
    SocialNotificationService,
    DiscussionNotificationService,
    RankingListenerAdapter,
    AchievementListenerAdapter,
    TournamentListenerAdapter,
    SocialListenerAdapter,
    SocialEventHandler,
    DiscussionListenerAdapter,
    NotificationApplicationService,
  ],
  controllers: [NotificationController],
  exports: [
    NOTIFICATION_REPOSITORY_PORT,
    NOTIFICATION_CHANNEL_SERVICE,
    NotificationService,
    NotificationChannelService,
    RankNotificationService,
    AchievementNotificationService,
    TournamentNotificationService,
    SocialNotificationService,
    DiscussionNotificationService,
    NotificationApplicationService,
  ],
})
export class NotificationModule {}
