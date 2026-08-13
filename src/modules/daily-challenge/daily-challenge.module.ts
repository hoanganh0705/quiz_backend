import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { DailyChallengeController } from './transport/controller/daily-challenge.controller';
import { DailyChallengePresenter } from './transport/presenters/daily-challenge.presenter';
import { DailyChallengeApplicationService } from './application/daily-challenge.application.service';
import { DailyChallengeRepository } from './infrastructure/repositories/daily-challenge.repository';
import { DailyChallengeSchedulerService } from './infrastructure/scheduler/daily-challenge-scheduler.service';
import { DAILY_CHALLENGE_REPOSITORY_PORT } from './domain/ports';
import {
  DAILY_CHALLENGE_DOMAIN_EVENT_BUS,
  DailyChallengeDomainEventBus,
} from './domain/events/daily-challenge-domain.event-bus';

/**
 * DailyChallengeModule
 *
 * Phase 3 (S-14): the four daily-challenge endpoints + the cron
 * scheduler that rotates the challenge at UTC midnight. Phase 3 also
 * adds the domain event bus so that downstream listeners (today:
 * `DailyChallengeCoinListenerAdapter` in the coins module) can
 * observe challenge completion without coupling to this module.
 */
@Module({
  imports: [DatabaseModule, QuizModule],
  controllers: [DailyChallengeController],
  providers: [
    DailyChallengeApplicationService,
    DailyChallengeRepository,
    DailyChallengePresenter,
    DailyChallengeSchedulerService,
    DailyChallengeDomainEventBus,
    {
      provide: DAILY_CHALLENGE_REPOSITORY_PORT,
      useClass: DailyChallengeRepository,
    },
    {
      provide: DAILY_CHALLENGE_DOMAIN_EVENT_BUS,
      useExisting: DailyChallengeDomainEventBus,
    },
  ],
  // The event bus is exported (both the class and the symbol token)
  // so the CoinModule can subscribe to it when its
  // `forwardRef(() => DailyChallengeModule)` import is resolved.
  exports: [
    DailyChallengeApplicationService,
    DAILY_CHALLENGE_REPOSITORY_PORT,
    DailyChallengeDomainEventBus,
    DAILY_CHALLENGE_DOMAIN_EVENT_BUS,
  ],
})
export class DailyChallengeModule {}
