import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { DiscussionApplicationService } from './application/discussion-application.service';
import { DiscussionService } from './domain/services/discussion.service';
import { DiscussionRepository } from './infrastructure/repositories/discussion.repository';
import { QuizExistenceAdapter } from './infrastructure/adapters/quiz-existence.adapter';
import { DiscussionController } from './transport/controller/discussion.controller';
import { DiscussionDomainExceptionFilter } from './transport/controller/filters/discussion-domain-exception.filter';
import {
  DISCUSSION_REPOSITORY_PORT,
  QUIZ_EXISTENCE_PORT,
} from './domain/ports';
import {
  DISCUSSION_DOMAIN_EVENT_BUS,
  DiscussionDomainEventBus,
} from './domain/events';

@Module({
  imports: [DatabaseModule],
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
  ],
  controllers: [DiscussionController],
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
