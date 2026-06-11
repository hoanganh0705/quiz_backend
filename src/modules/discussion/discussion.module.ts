import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@/core/database/database.module';
import { DiscussionApplicationService } from './application/discussion-application.service';
import { DiscussionService } from './domain/services/discussion.service';
import { DiscussionRepository } from './infrastructure/repositories/discussion.repository';
import { QuizExistenceAdapter } from './infrastructure/adapters/quiz-existence.adapter';
import { DiscussionNotificationListener } from './infrastructure/adapters/discussion-notification-listener.adapter';
import { DiscussionController } from './transport/controller/discussion.controller';
import { QuizDiscussionController } from './transport/controller/quiz-discussion.controller';
import { UserDiscussionController } from './transport/controller/user-discussion.controller';
import { DiscussionDomainExceptionFilter } from './transport/controller/filters/discussion-domain-exception.filter';
import { DISCUSSION_REPOSITORY_PORT, QUIZ_EXISTENCE_PORT } from './domain/ports';
import { DISCUSSION_DOMAIN_EVENT_BUS, DiscussionDomainEventBus } from './domain/events';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { UserModule } from '@/modules/user/user.module';
import { NotificationModule } from '@/modules/notification/notification.module';

@Module({
  imports: [DatabaseModule, QuizModule, forwardRef(() => UserModule), JwtModule, NotificationModule],
  providers: [
    DiscussionApplicationService,
    DiscussionService,
    DiscussionRepository,
    QuizExistenceAdapter,
    DiscussionDomainExceptionFilter,
    { provide: DISCUSSION_REPOSITORY_PORT, useExisting: DiscussionRepository },
    { provide: DISCUSSION_DOMAIN_EVENT_BUS, useExisting: DiscussionDomainEventBus },
    { provide: QUIZ_EXISTENCE_PORT, useExisting: QuizExistenceAdapter },
    DiscussionDomainEventBus,

    // Notification bridge
    DiscussionNotificationListener,
  ],
  controllers: [DiscussionController, QuizDiscussionController, UserDiscussionController],
  exports: [
    DiscussionService,
    DiscussionApplicationService,
    DISCUSSION_REPOSITORY_PORT,
    DISCUSSION_DOMAIN_EVENT_BUS,
    DiscussionDomainEventBus,
    QUIZ_EXISTENCE_PORT,
  ],
})
export class DiscussionModule {}
