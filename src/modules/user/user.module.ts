import { Module, forwardRef } from '@nestjs/common';
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
import {
  USER_ACTIVITY_SERVICE,
  UserActivityServiceImpl,
} from './application/user-activity.service';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { QuizApplicationService } from '@/modules/quiz/application/quiz.application.service';
import { StreakService } from './domain/services/streak.service';
import { RankingModule } from '@/modules/ranking/ranking.module';
import { RankingXpStreakListenerAdapter } from './infrastructure/adapters/ranking-xp-streak-listener.adapter';

@Module({
  imports: [DatabaseModule, forwardRef(() => QuizModule), forwardRef(() => RankingModule)],
  controllers: [UserController],
  providers: [
    UserApplicationService,
    UserDomainService,
    UserRepository,
    UserSearchAdapter,
    UserDomainEventBus,
    UserActivityServiceImpl,
    { provide: USER_REPOSITORY_PORT, useClass: UserRepository },
    { provide: USER_DOMAIN_EVENT_BUS, useExisting: UserDomainEventBus },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    { provide: USER_ACTIVITY_SERVICE, useExisting: UserActivityServiceImpl },
    { provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService },
    UserDomainExceptionFilter,
    StreakService,
    RankingXpStreakListenerAdapter,
  ],
  exports: [
    UserApplicationService,
    UserDomainService,
    USER_REPOSITORY_PORT,
    USER_DOMAIN_EVENT_BUS,
    USER_SEARCH_PORT,
    USER_ACTIVITY_SERVICE,
    UserDomainEventBus,
    UserActivityServiceImpl,
    StreakService,
  ],
})
export class UserModule {}
