import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationApplicationService } from './application/notification-application.service';
import { NotificationService } from './domain/notification.service';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationPreferencesRepository } from './infrastructure/repositories/notification-preferences.repository';
import { NotificationController } from './transport/controller/notification.controller';
import {
  NOTIFICATION_CHANNEL_SERVICE,
  NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
  NOTIFICATION_REPOSITORY_PORT,
  NOTIFICATION_PREFERENCES_REPOSITORY_PORT,
  NOTIFICATION_DOMAIN_EVENT_BUS,
  SOCIAL_NOTIFICATION_PORT,
  ACHIEVEMENT_NOTIFICATION_PORT,
  TOURNAMENT_NOTIFICATION_PORT,
  INSTANCE_NOTIFICATION_PORT,
  RANK_NOTIFICATION_PORT,
} from './domain/ports';
import { NotificationChannelService } from './infrastructure/adapters';
import { RankNotificationService } from './domain/services/rank-notification.service';
import {
  TournamentNotificationService,
  InstanceNotificationService,
  ReviewNotificationService,
  UserNotificationService,
  SocialNotificationService,
  AchievementNotificationService,
} from './domain/services';
import { NotificationDomainEventBus } from './domain/events/notification-domain.event-bus';
import { DiscussionModule } from '@/modules/discussion/discussion.module';
import { DiscussionNotificationListener } from './infrastructure/adapters/discussion-notification-listener.adapter';
import { InstanceModule } from '@/modules/instance/instance.module';
import { InstanceNotificationListener } from './infrastructure/adapters/instance-notification-listener.adapter';
import { ReviewModule } from '@/modules/review/review.module';
import { ReviewNotificationListener } from './infrastructure/adapters/review-notification-listener.adapter';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { UserModule } from '@/modules/user/user.module';
import { UserNotificationListener } from './infrastructure/adapters/user-notification-listener.adapter';
import { NotificationGateway } from './transport/gateway/notification.gateway';
import { NotificationWebSocketListener } from './infrastructure/adapters/notification-websocket-listener.adapter';
import { NotificationPresenter } from './transport/presenters/notification.presenter';
import { NotificationCleanupScheduler } from './infrastructure/scheduler/notification-cleanup.scheduler';

@Module({
  imports: [
    DatabaseModule,
    JwtModule,
    forwardRef(() => DiscussionModule),
    forwardRef(() => InstanceModule),
    forwardRef(() => ReviewModule),
    forwardRef(() => QuizModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    NotificationRepository,
    NotificationPreferencesRepository,
    {
      provide: NOTIFICATION_REPOSITORY_PORT,
      useExisting: NotificationRepository,
    },
    {
      provide: NOTIFICATION_PREFERENCES_REPOSITORY_PORT,
      useExisting: NotificationPreferencesRepository,
    },
    NotificationService,
    {
      provide: NOTIFICATION_CHANNEL_SERVICE,
      useExisting: NotificationChannelService,
    },
    {
      provide: NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
      useExisting: NotificationChannelService,
    },
    {
      provide: NOTIFICATION_DOMAIN_EVENT_BUS,
      useExisting: NotificationDomainEventBus,
    },
    NotificationChannelService,
    NotificationDomainEventBus,
    NotificationApplicationService,
    NotificationCleanupScheduler,
    RankNotificationService,
    {
      provide: RANK_NOTIFICATION_PORT,
      useExisting: RankNotificationService,
    },
    TournamentNotificationService,
    {
      provide: TOURNAMENT_NOTIFICATION_PORT,
      useExisting: TournamentNotificationService,
    },
    InstanceNotificationService,
    {
      provide: INSTANCE_NOTIFICATION_PORT,
      useExisting: InstanceNotificationService,
    },
    DiscussionNotificationListener,
    InstanceNotificationListener,
    ReviewNotificationListener,
    ReviewNotificationService,
    UserNotificationService,
    UserNotificationListener,
    SocialNotificationService,
    {
      provide: SOCIAL_NOTIFICATION_PORT,
      useExisting: SocialNotificationService,
    },
    AchievementNotificationService,
    {
      provide: ACHIEVEMENT_NOTIFICATION_PORT,
      useExisting: AchievementNotificationService,
    },
    NotificationGateway,
    NotificationWebSocketListener,
    NotificationPresenter,
  ],
  controllers: [NotificationController],
  exports: [
    NOTIFICATION_REPOSITORY_PORT,
    NOTIFICATION_PREFERENCES_REPOSITORY_PORT,
    NOTIFICATION_CHANNEL_SERVICE,
    NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
    NOTIFICATION_DOMAIN_EVENT_BUS,
    NotificationService,
    NotificationChannelService,
    NotificationDomainEventBus,
    NotificationApplicationService,
    NotificationCleanupScheduler,
    RankNotificationService,
    RANK_NOTIFICATION_PORT,
    TournamentNotificationService,
    TOURNAMENT_NOTIFICATION_PORT,
    InstanceNotificationService,
    INSTANCE_NOTIFICATION_PORT,
    SocialNotificationService,
    SOCIAL_NOTIFICATION_PORT,
    AchievementNotificationService,
    ACHIEVEMENT_NOTIFICATION_PORT,
  ],
})
export class NotificationModule {}
