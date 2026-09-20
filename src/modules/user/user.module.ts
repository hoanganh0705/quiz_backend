import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './transport/controller/user.controller';
import { UserApplicationService } from './application/user.application.service';
import { UserDomainService, USER_DOMAIN_SERVICE } from './domain/user.service';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UserAccountRepository } from './infrastructure/repositories/aggregates/user-account.repository';
import { UserProfileRepository } from './infrastructure/repositories/aggregates/user-profile.repository';
import { UserSettingsRepository } from './infrastructure/repositories/aggregates/user-settings.repository';
import { UserBadgeRepository } from './infrastructure/repositories/aggregates/user-badge.repository';
import { UserRankingRepository } from './infrastructure/repositories/aggregates/user-ranking.repository';
import { UserActivityRepository } from './infrastructure/repositories/aggregates/user-activity.repository';
import { UserTournamentRepository } from './infrastructure/repositories/aggregates/user-tournament.repository';
import { UserAnalyticsRepository } from './infrastructure/repositories/aggregates/user-analytics.repository';
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
import { SocialModule } from '@/modules/social/social.module';
import { RecentlyPlayedQuizzesService } from './application/recently-played-quizzes.service';
import { UserProfileBundleService } from './application/user-profile-bundle.service';
import { UserSummaryService } from './application/user-summary.service';
import { COIN_REPOSITORY_PORT } from '@/modules/coins/domain/ports/coin-repository.port';
import { CoinRepository } from '@/modules/coins/infrastructure/repositories/coin.repository';
import { CoinModule } from '@/modules/coins/coin.module';
import { UserResponseMapper } from './mappers/user-response.mapper';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => QuizModule),
    forwardRef(() => RankingModule),
    forwardRef(() => SocialModule),
    forwardRef(() => CoinModule),
  ],
  controllers: [UserController],
  providers: [
    UserApplicationService,
    UserDomainService,
    UserRepository,
    UserSearchAdapter,
    UserDomainEventBus,
    UserActivityServiceImpl,
    UserAccountRepository,
    UserProfileRepository,
    UserSettingsRepository,
    UserBadgeRepository,
    UserRankingRepository,
    UserActivityRepository,
    UserTournamentRepository,
    UserAnalyticsRepository,
    { provide: USER_REPOSITORY_PORT, useExisting: UserRepository },
    { provide: USER_DOMAIN_EVENT_BUS, useExisting: UserDomainEventBus },
    { provide: USER_SEARCH_PORT, useExisting: UserSearchAdapter },
    { provide: USER_ACTIVITY_SERVICE, useExisting: UserActivityServiceImpl },
    { provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService },
    { provide: USER_DOMAIN_SERVICE, useExisting: UserDomainService },
    StreakService,
    RankingXpStreakListenerAdapter,
    UserPresenter,
    RecentlyPlayedQuizzesService,
    UserProfileBundleService,
    UserSummaryService,
    UserResponseMapper,
    CoinRepository,
    { provide: COIN_REPOSITORY_PORT, useExisting: CoinRepository },
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
