import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { ReviewApplicationService } from './application/review.application.service';
import { ReviewService } from './domain/review.service';
import { ReviewAdminService } from './domain/review-admin.service';
import { IdempotencyService, IDEMPOTENCY_SERVICE } from './domain/idempotency.service';
import { IdempotencyCleanupScheduler } from './domain/idempotency-cleanup.scheduler';
import { ReviewResponseMapper } from './mappers/review-response.mapper';
import { CursorMapper } from './mappers/review-cursor.mapper';
import { ReviewController } from './transport/controller/review.controller';
import { UserReviewController } from './transport/controller/user-review.controller';
import { AdminReviewController } from './transport/controller/admin-review.controller';
import { ReviewPresenter } from './transport/presenters/review.presenter';
import {
  REVIEW_REPOSITORY_PORT,
  REVIEW_REPORT_REPOSITORY_PORT,
  REVIEW_OUTBOX_PORT,
} from './domain/ports';
import { REVIEW_DOMAIN_EVENT_BUS, ReviewDomainEventBus } from './domain/events';
import { ReviewRepository } from './infrastructure/repositories/review.repository';
import { ReviewReportRepository } from './infrastructure/repositories/review-report.repository';
import { QuizModule } from '@/modules/quiz/quiz.module';
import { QuizReviewController } from './transport/controller/quiz-review.controller';
import { ReviewOutboxAdapter } from './infrastructure/outbox/review-outbox.adapter';
import { ReviewOutboxProcessorService } from './infrastructure/outbox/review-outbox-processor.service';
import { ReviewOutboxSchedulerService } from './infrastructure/outbox/review-outbox.scheduler';

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

    // Repository Implementations
    ReviewRepository,
    ReviewReportRepository,

    // Port bindings
    { provide: REVIEW_REPOSITORY_PORT, useExisting: ReviewRepository },
    { provide: REVIEW_REPORT_REPOSITORY_PORT, useExisting: ReviewReportRepository },
    { provide: REVIEW_OUTBOX_PORT, useExisting: ReviewOutboxAdapter },
    { provide: IDEMPOTENCY_SERVICE, useExisting: IdempotencyService },

    // Infrastructure
    IdempotencyService,
    ReviewOutboxAdapter,
    ReviewOutboxProcessorService,
    ReviewOutboxSchedulerService,
    IdempotencyCleanupScheduler,

    // Domain Event Bus
    ReviewDomainEventBus,
    { provide: REVIEW_DOMAIN_EVENT_BUS, useExisting: ReviewDomainEventBus },
  ],
  controllers: [
    ReviewController,
    QuizReviewController,
    UserReviewController,
    AdminReviewController,
  ],
  exports: [ReviewApplicationService, REVIEW_DOMAIN_EVENT_BUS, ReviewDomainEventBus],
})
export class ReviewModule {}
