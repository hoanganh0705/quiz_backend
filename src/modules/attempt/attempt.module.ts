import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AttemptApplicationService } from './application/attempt.application.service';
import { AttemptCommandService } from './domain/attempt-command.service';
import { AttemptQueryService } from './domain/attempt-query.service';
import { AttemptResponseMapper } from './mappers/attempt-response.mapper';
import { AttemptController } from './transport/controller/attempt.controller';
import { QuizHistoryController } from './transport/controller/quiz-history.controller';
import { AttemptPresenter } from './transport/presenters/attempt.presenter';
import { ATTEMPT_REPOSITORY_PORT } from './domain/ports';
import { ATTEMPT_ANSWER_REPOSITORY_PORT } from './domain/ports/attempt-answer-repository.port';
import { AttemptRepository } from './infrastructure/repositories/attempt.repository';
import { AttemptAnswerRepository } from './infrastructure/repositories/attempt-answer.repository';
import { AttemptDomainEventBus } from './domain/events/attempt-domain.event-bus';
import { ATTEMPT_DOMAIN_EVENT_BUS } from './domain/events/attempt-domain-event-bus.port';
import { AttemptDomainEventBootstrapService } from './domain/events/attempt-domain-event-bootstrap.service';
import { QuizModule } from '@/modules/quiz/quiz.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => QuizModule)],
  providers: [
    // Application
    AttemptApplicationService,

    // Domain
    AttemptCommandService,
    AttemptQueryService,

    // Event Bus
    AttemptDomainEventBus,

    // Event Bootstrap
    AttemptDomainEventBootstrapService,

    // Mapper
    AttemptResponseMapper,

    // Presentation
    AttemptPresenter,

    // Repository Implementations
    AttemptRepository,
    AttemptAnswerRepository,

    // Port bindings
    { provide: ATTEMPT_REPOSITORY_PORT, useExisting: AttemptRepository },
    { provide: ATTEMPT_ANSWER_REPOSITORY_PORT, useExisting: AttemptAnswerRepository },
    { provide: ATTEMPT_DOMAIN_EVENT_BUS, useExisting: AttemptDomainEventBus },
  ],
  controllers: [AttemptController, QuizHistoryController],
  exports: [
    AttemptApplicationService,
    ATTEMPT_REPOSITORY_PORT,
    ATTEMPT_ANSWER_REPOSITORY_PORT,
    AttemptCommandService,
    ATTEMPT_DOMAIN_EVENT_BUS,
  ],
})
export class AttemptModule {}
