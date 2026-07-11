import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { ReviewApplicationService } from './application/review.application.service';
import { ReviewService } from './domain/review.service';
import { ReviewAdminService } from './domain/review-admin.service';
import { IdempotencyService, IDEMPOTENCY_SERVICE } from './domain/idempotency.service';
import { ReviewResponseMapper } from './mappers/review-response.mapper';
import { CursorMapper } from './mappers/review-cursor.mapper';
import { ReviewController } from './transport/controller/review.controller';
import { UserReviewController } from './transport/controller/user-review.controller';
import { AdminReviewController } from './transport/controller/admin-review.controller';
import { ReviewDomainExceptionFilter } from './transport/filters/review-domain-exception.filter';
import { ReviewPresenter } from './transport/presenters/review.presenter';
import { REVIEW_REPOSITORY_PORT } from './domain/ports';
import {
  REVIEW_ANALYTICS_PORT,
  REVIEW_DOMAIN_EVENT_BUS,
  ReviewDomainEventBus,
} from './domain/events';
import { ReviewRepository } from './infrastructure/repositories/review.repository';
import { ReviewAnalyticsAdapter } from './infrastructure/repositories/review-analytics.adapter';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { quizReviewController } from './transport/controller/quiz-review.controller';

@Module({
  imports: [DatabaseModule, forwardRef(() => QuizModule)],
  providers: [
    // Application
    ReviewApplicationService,

    // Domain
    ReviewService,
    ReviewAdminService,
    IdempotencyService,

    // Mapper
    ReviewResponseMapper,
    CursorMapper,

    // Presenter
    ReviewPresenter,

    // Exception filter
    ReviewDomainExceptionFilter,

    // Port bindings
    { provide: REVIEW_REPOSITORY_PORT, useExisting: ReviewRepository },
    { provide: IDEMPOTENCY_SERVICE, useExisting: IdempotencyService },
    { provide: REVIEW_ANALYTICS_PORT, useExisting: ReviewAnalyticsAdapter },

    // Infrastructure
    ReviewRepository,
    ReviewAnalyticsAdapter,
    IdempotencyService,

    // Domain Event Bus
    ReviewDomainEventBus,
    { provide: REVIEW_DOMAIN_EVENT_BUS, useExisting: ReviewDomainEventBus },
  ],
  controllers: [
    ReviewController,
    quizReviewController,
    UserReviewController,
    AdminReviewController,
  ],
  exports: [ReviewApplicationService, REVIEW_DOMAIN_EVENT_BUS, ReviewDomainEventBus],
})
export class ReviewModule {}
