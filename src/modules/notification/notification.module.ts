import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationApplicationService } from './application/notification-application.service';
import { NotificationSchedulerService } from './application/notification-scheduler.service';
import { NotificationService } from './domain/notification.service';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationController } from './transport/controller/notification.controller';
import {
  NOTIFICATION_CHANNEL_SERVICE,
  NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
  NOTIFICATION_REPOSITORY_PORT,
  NOTIFICATION_DOMAIN_EVENT_BUS,
} from './domain/ports';
import { NotificationChannelService } from './infrastructure/adapters';
import { RankNotificationService } from './domain/services/rank-notification.service';
import {
  TournamentNotificationService,
  InstanceNotificationService,
  ReviewNotificationService,
  UserNotificationService,
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

@Module({
  imports: [DatabaseModule, JwtModule, forwardRef(() => DiscussionModule), forwardRef(() => InstanceModule), forwardRef(() => ReviewModule), forwardRef(() => QuizModule), forwardRef(() => UserModule)],
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
    NotificationSchedulerService,
    RankNotificationService,
    TournamentNotificationService,
    InstanceNotificationService,
    DiscussionNotificationListener,
    InstanceNotificationListener,
    ReviewNotificationListener,
    UserNotificationService,
    UserNotificationListener,
    NotificationGateway,
    NotificationWebSocketListener,
  ],
  controllers: [NotificationController],
  exports: [
    NOTIFICATION_REPOSITORY_PORT,
    NOTIFICATION_CHANNEL_SERVICE,
    NOTIFICATION_CHANNEL_SERVICE_INSTANCE,
    NOTIFICATION_DOMAIN_EVENT_BUS,
    NotificationService,
    NotificationChannelService,
    NotificationDomainEventBus,
    NotificationApplicationService,
    NotificationSchedulerService,
    RankNotificationService,
    TournamentNotificationService,
    InstanceNotificationService,
  ],
})
export class NotificationModule {}
