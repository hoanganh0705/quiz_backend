import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { ReviewApplicationService } from './application/review.application.service';
import { ReviewService } from './domain/review.service';
import { ReviewAdminService } from './domain/review-admin.service';
import { IdempotencyService, IDEMPOTENCY_SERVICE } from './domain/idempotency.service';
import { ReviewResponseMapper } from './mappers/review-response.mapper';
import { CursorMapper } from './mappers/review-cursor.mapper';
import { ReviewController } from './transport/controller/review.controller';
import { QuizReviewController } from './transport/controller/quiz-review.controller';
import { UserReviewController } from './transport/controller/user-review.controller';
import { AdminReviewController } from './transport/controller/admin-review.controller';
import { ReviewDomainExceptionFilter } from './transport/filters/review-domain-exception.filter';
import { REVIEW_REPOSITORY_PORT } from './domain/ports';
import { REVIEW_ANALYTICS_PORT } from './domain/events';
import { ReviewRepository } from './infrastructure/repositories/review.repository';
import { ReviewAnalyticsAdapter } from './infrastructure/repositories/review-analytics.adapter';
import { QuizModule } from '@/modules/quiz/quiz.module';

@Module({
  imports: [DatabaseModule, QuizModule],
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

    // Exception filter
    ReviewDomainExceptionFilter,

    // Port bindings
    { provide: REVIEW_REPOSITORY_PORT, useExisting: ReviewRepository },
    { provide: REVIEW_ANALYTICS_PORT, useExisting: ReviewAnalyticsAdapter },
    { provide: IDEMPOTENCY_SERVICE, useExisting: IdempotencyService },

    // Infrastructure
    ReviewRepository,
    ReviewAnalyticsAdapter,
    IdempotencyService,
  ],
  controllers: [
    ReviewController,
    QuizReviewController,
    UserReviewController,
    AdminReviewController,
  ],
  exports: [ReviewApplicationService],
})
export class ReviewModule {}
