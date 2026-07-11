import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { DiscussionApplicationService } from './application/discussion-application.service';
import { DiscussionService } from './domain/services/discussion.service';
import { DiscussionRepository } from './infrastructure/repositories/discussion.repository';
import { DiscussionModeratorAuditService } from './infrastructure/audit/discussion-moderator-audit.service';
import { DiscussionCleanupService } from './infrastructure/scheduler/discussion-cleanup.service';
import { QuizExistenceAdapter } from './infrastructure/adapters/quiz-existence.adapter';
import { UserExistenceAdapter } from './infrastructure/adapters/user-existence.adapter';
import { DiscussionController } from './transport/controller/discussion.controller';
import { QuizDiscussionController } from './transport/controller/quiz-discussion.controller';
import { UserDiscussionController } from './transport/controller/user-discussion.controller';
import { DiscussionPresenter } from './transport/presenters/discussion.presenter';
import {
  DISCUSSION_REPOSITORY_PORT,
  QUIZ_EXISTENCE_PORT,
  USER_EXISTENCE_PORT,
} from './domain/ports';
import { DISCUSSION_DOMAIN_EVENT_BUS, DiscussionDomainEventBus } from './domain/events';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => QuizModule), forwardRef(() => UserModule)],
  providers: [
    DiscussionApplicationService,
    DiscussionService,
    DiscussionRepository,
    DiscussionModeratorAuditService,
    DiscussionCleanupService,
    QuizExistenceAdapter,
    UserExistenceAdapter,
    DiscussionPresenter,
    { provide: DISCUSSION_REPOSITORY_PORT, useExisting: DiscussionRepository },
    { provide: DISCUSSION_DOMAIN_EVENT_BUS, useExisting: DiscussionDomainEventBus },
    { provide: QUIZ_EXISTENCE_PORT, useExisting: QuizExistenceAdapter },
    { provide: USER_EXISTENCE_PORT, useExisting: UserExistenceAdapter },
    DiscussionDomainEventBus,
  ],
  controllers: [DiscussionController, QuizDiscussionController, UserDiscussionController],
  exports: [
    DiscussionService,
    DiscussionApplicationService,
    DISCUSSION_REPOSITORY_PORT,
    DISCUSSION_DOMAIN_EVENT_BUS,
    DiscussionDomainEventBus,
    QUIZ_EXISTENCE_PORT,
    USER_EXISTENCE_PORT,
    DiscussionModeratorAuditService,
  ],
})
export class DiscussionModule {}
