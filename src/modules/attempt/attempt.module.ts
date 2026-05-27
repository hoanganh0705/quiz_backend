import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AttemptApplicationService } from './application/attempt.application.service';
import { AttemptService } from './domain/attempt.service';
import { AttemptResponseMapper } from './mappers/attempt-response.mapper';
import { AttemptController } from './transport/controller/attempt.controller';
import { AttemptDomainExceptionFilter } from './transport/filters/attempt-domain-exception.filter';
import { ATTEMPT_REPOSITORY_PORT } from './domain/ports';
import { AttemptRepository } from './infrastructure/repositories/attempt.repository';
import { QuizModule } from '@/modules/quiz/quiz.module';

@Module({
  imports: [DatabaseModule, QuizModule],
  providers: [
    // Application
    AttemptApplicationService,

    // Domain
    AttemptService,

    // Mapper
    AttemptResponseMapper,

    // Exception filter
    AttemptDomainExceptionFilter,

    // Port bindings
    { provide: ATTEMPT_REPOSITORY_PORT, useExisting: AttemptRepository },
  ],
  controllers: [AttemptController],
  exports: [AttemptApplicationService, ATTEMPT_REPOSITORY_PORT],
})
export class AttemptModule {}
