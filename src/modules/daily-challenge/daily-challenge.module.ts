import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { DailyChallengeController } from './transport/controller/daily-challenge.controller';
import { DailyChallengePresenter } from './transport/presenters/daily-challenge.presenter';
import { DailyChallengeApplicationService } from './application/daily-challenge.application.service';
import { DailyChallengeRepository } from './infrastructure/repositories/daily-challenge.repository';
import { DailyChallengeSchedulerService } from './infrastructure/scheduler/daily-challenge-scheduler.service';
import { DAILY_CHALLENGE_REPOSITORY_PORT } from './domain/ports';

@Module({
  imports: [DatabaseModule, QuizModule],
  controllers: [DailyChallengeController],
  providers: [
    DailyChallengeApplicationService,
    DailyChallengeRepository,
    DailyChallengePresenter,
    DailyChallengeSchedulerService,
    {
      provide: DAILY_CHALLENGE_REPOSITORY_PORT,
      useClass: DailyChallengeRepository,
    },
  ],
  exports: [DailyChallengeApplicationService, DAILY_CHALLENGE_REPOSITORY_PORT],
})
export class DailyChallengeModule {}
