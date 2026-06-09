import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';

// Application Services
import { QuizApplicationService } from './application/quiz.application.service';
import { QuizVersionApplicationService } from './application/quiz-version.application.service';
import { QuizQuestionApplicationService } from './application/quiz-question.application.service';

// Domain Services
import { QuizQueryService } from './domain/quiz/quiz-query.service';
import { QuizCommandService } from './domain/quiz/quiz-command.service';
import { QuizVersionService } from './domain/version/quiz-version.service';
import { QuizQuestionService } from './domain/question/quiz-question.service';

// Analytics Domain Services
import {
  QuizAnalyticsService,
  MetricsCalculatorService,
  TrendingService,
  PopularityService,
  QUIZ_ANALYTICS_REPOSITORY_PORT,
} from './domain/analytics';
import { QuizAnalyticsRepository } from './domain/analytics/quiz-analytics.repository';
import { QuizRecommendationRepository } from './infrastructure/repositories/quiz-recommendation.repository';
import { QUIZ_RECOMMENDATION_REPOSITORY_PORT } from './domain/analytics/ports/quiz-recommendation.repository-port';
import { AnalyticsSchedulerService } from './scheduler';
import { AnalyticsEventHandler } from './domain/analytics/analytics-event-handler';

// Domain Events
import { QuizDomainEventBus } from './domain/events/quiz-domain.event-bus';
import { QUIZ_DOMAIN_EVENT_BUS } from './domain/ports/quiz-domain-event-bus.port';

// Transport
import { QuizController } from './transport/controller/quiz.controller';
import { QuizVersionController } from './transport/controller/quiz-version.controller';
import { QuizDomainExceptionFilter } from './transport/filters/quiz-domain-exception.filter';

// Repository Ports
import { QUIZ_REPOSITORY_PORT } from './domain/ports/quiz-repository.port';
import { QUIZ_VERSION_REPOSITORY_PORT } from './domain/ports/quiz-version-repository.port';
import { QUIZ_QUESTION_REPOSITORY_PORT } from './domain/ports/quiz-question-repository.port';

// Repository Implementations
import { QuizRepository } from './infrastructure/repositories/quiz.repository';
import { QuizVersionRepository } from './infrastructure/repositories/quiz-version.repository';
import { QuizQuestionRepository } from './infrastructure/repositories/quiz-question.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Application Services
    QuizApplicationService,
    QuizVersionApplicationService,
    QuizQuestionApplicationService,

    // Domain Services
    QuizQueryService,
    QuizCommandService,
    QuizVersionService,
    QuizQuestionService,

    // Analytics Domain Services
    QuizAnalyticsService,
    MetricsCalculatorService,
    TrendingService,
    PopularityService,
    QuizAnalyticsRepository,
    AnalyticsSchedulerService,
    AnalyticsEventHandler,

    // Exception Filter
    QuizDomainExceptionFilter,

    // Repository Implementations
    QuizRepository,
    QuizVersionRepository,
    QuizQuestionRepository,
    QuizRecommendationRepository,

    // Port → Implementation Bindings
    { provide: QUIZ_REPOSITORY_PORT, useExisting: QuizRepository },
    { provide: QUIZ_VERSION_REPOSITORY_PORT, useExisting: QuizVersionRepository },
    { provide: QUIZ_QUESTION_REPOSITORY_PORT, useExisting: QuizQuestionRepository },
    { provide: QUIZ_DOMAIN_EVENT_BUS, useExisting: QuizDomainEventBus },
    { provide: QUIZ_ANALYTICS_REPOSITORY_PORT, useExisting: QuizAnalyticsRepository },
    { provide: QUIZ_RECOMMENDATION_REPOSITORY_PORT, useExisting: QuizRecommendationRepository },

    // Domain Event Bus
    QuizDomainEventBus,
  ],
  controllers: [QuizController, QuizVersionController],
  exports: [
    QUIZ_REPOSITORY_PORT,
    QUIZ_DOMAIN_EVENT_BUS,
    QuizApplicationService,
    QuizAnalyticsService,
    MetricsCalculatorService,
    AnalyticsEventHandler,
    QUIZ_RECOMMENDATION_REPOSITORY_PORT,
  ],
})
export class QuizModule {}
