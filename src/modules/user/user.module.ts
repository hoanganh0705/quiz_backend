import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './transport/controller/user.controller';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainService, USER_DOMAIN_SERVICE } from './domain/user.service';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserSearchAdapter } from './infrastructure/adapters/user-search.adapter';
import { UserDomainEventBus } from './domain/events/user-domain.event-bus';
import { DatabaseModule } from '@/core/database/database.module';
import { USER_REPOSITORY_PORT } from './domain/ports/user-repository.port';
import { USER_DOMAIN_EVENT_BUS } from './domain/events/user-domain-event-bus.port';
import { USER_SEARCH_PORT } from './domain/ports/user-search.port';
import { QUIZ_LISTING_PORT } from '@/modules/quiz/domain/analytics/ports/quiz-listing.port';
import {
  USER_ACTIVITY_SERVICE,
  UserActivityServiceImpl,
} from './application/user-activity.service';
import { UserPresenter } from './transport/presenters/user.presenter';
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
    // Phase 2 (F-8): use `useExisting` instead of `useClass` — the global
    // `DatabaseModule` already provides `UserRepository`. With `useClass`
    // Nest would build a *second* instance for the `USER_REPOSITORY_PORT`
    // token, so any consumer that injects the token would see a different
    // instance than any consumer that injects the class directly (e.g.
    // `StreakService` post-F-5, social listeners, etc.).
    { provide: USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: USER_DOMAIN_EVENT_BUS, useExisting: UserDomainEventBus },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    { provide: USER_ACTIVITY_SERVICE, useExisting: UserActivityServiceImpl },
    { provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService },
    { provide: USER_DOMAIN_SERVICE, useExisting: UserDomainService },
    StreakService,
    RankingXpStreakListenerAdapter,
    UserPresenter,
  ],
  exports: [
    UserApplicationService,
    UserDomainService,
    USER_REPOSITORY_PORT,
    USER_DOMAIN_EVENT_BUS,
    USER_SEARCH_PORT,
    USER_ACTIVITY_SERVICE,
    USER_DOMAIN_SERVICE,
    UserDomainEventBus,
    UserActivityServiceImpl,
    StreakService,
  ],
})
export class UserModule {}
