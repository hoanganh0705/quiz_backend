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
import {
  DailyChallengeOutboxAdapter,
  DAILY_CHALLENGE_OUTBOX_PORT,
} from './infrastructure/outbox/daily-challenge-xp-outbox.adapter';
import { DailyChallengeXpOutboxProcessorService } from './infrastructure/outbox/daily-challenge-xp-outbox-processor.service';
import { DailyChallengeXpOutboxSchedulerService } from './infrastructure/outbox/daily-challenge-xp-outbox.scheduler';

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

    DailyChallengeOutboxAdapter,
    {
      provide: DAILY_CHALLENGE_OUTBOX_PORT,
      useExisting: DailyChallengeOutboxAdapter,
    },
    DailyChallengeXpOutboxProcessorService,
    DailyChallengeXpOutboxSchedulerService,
  ],

  exports: [
    DailyChallengeApplicationService,
    DAILY_CHALLENGE_REPOSITORY_PORT,
    DailyChallengeDomainEventBus,
    DAILY_CHALLENGE_DOMAIN_EVENT_BUS,

    DAILY_CHALLENGE_OUTBOX_PORT,
  ],
})
export class DailyChallengeModule {}
