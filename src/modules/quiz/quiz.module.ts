import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { QuizApplicationService } from './application/quiz.application.service';
import { QuizReadService } from './domain/quiz/quiz-read.service';
import { QuizWriteService } from './domain/quiz/quiz-write.service';
import { QuizVersionService } from './domain/version/quiz-version.service';
import { QuizQuestionService } from './domain/question/quiz-question.service';
import { QuizResponseMapper } from './mappers/quiz-response.mapper';
import { QuizVersionResponseMapper } from './mappers/quiz-version-response.mapper';
import { QuizQuestionResponseMapper } from './mappers/quiz-question-response.mapper';
import { QuizController } from './transport/controller/quiz.controller';
import { QuizVersionController } from './transport/controller/quiz-version.controller';
import { QuizDomainExceptionFilter } from './transport/filters/quiz-domain-exception.filter';
import { QUIZ_REPOSITORY_PORT } from './domain/ports/quiz-repository.port';
import { QUIZ_VERSION_REPOSITORY_PORT } from './domain/ports/quiz-version-repository.port';
import { QUIZ_QUESTION_REPOSITORY_PORT } from './domain/ports/quiz-question-repository.port';
import { QuizRepository } from '@/core/database/repositories/quiz.repository';
import { QuizVersionRepository } from '@/core/database/repositories/quiz-version.repository';
import { QuizQuestionRepository } from '@/core/database/repositories/quiz-question.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Application
    QuizApplicationService,

    // Domain
    QuizReadService,
    QuizWriteService,
    QuizVersionService,
    QuizQuestionService,

    // Mappers
    QuizResponseMapper,
    QuizVersionResponseMapper,
    QuizQuestionResponseMapper,

    // Exception filter
    QuizDomainExceptionFilter,

    // Port bindings
    { provide: QUIZ_REPOSITORY_PORT, useExisting: QuizRepository },
    { provide: QUIZ_VERSION_REPOSITORY_PORT, useExisting: QuizVersionRepository },
    { provide: QUIZ_QUESTION_REPOSITORY_PORT, useExisting: QuizQuestionRepository },
  ],
  controllers: [QuizController, QuizVersionController],
  exports: [QUIZ_REPOSITORY_PORT],
})
export class QuizModule {}
