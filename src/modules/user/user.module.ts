import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainService } from './domain/user.service';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserSearchAdapter } from './infrastructure/adapters/user-search.adapter';
import { UserDomainEventBus } from './domain/events/user-domain.event-bus';
import { DatabaseModule } from '@/core/database/database.module';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { USER_DOMAIN_EVENT_BUS } from './domain/events/user-domain-event-bus.port';
import { USER_SEARCH_PORT } from './domain/ports/user-search.port';
import { QUIZ_LISTING_PORT } from '@/modules/quiz/domain/analytics/ports/quiz-listing.port';
import { UserDomainExceptionFilter } from './transport/filters/user-domain-exception.filter';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { UserHealthController } from './transport/controllers/user-health.controller';

@Module({
  imports: [DatabaseModule, QuizModule],
  controllers: [UserController, UserHealthController],
  providers: [
    UserApplicationService,
    UserDomainService,
    UserRepository,
    UserSearchAdapter,
    UserDomainEventBus,
    { provide: USER_REPOSITORY_PORT, useClass: UserRepository },
    { provide: USER_DOMAIN_EVENT_BUS, useExisting: UserDomainEventBus },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    UserDomainExceptionFilter,
  ],
  exports: [
    UserApplicationService,
    USER_REPOSITORY_PORT,
    USER_DOMAIN_EVENT_BUS,
    USER_SEARCH_PORT,
    UserDomainEventBus,
  ],
})
export class UserModule {}
