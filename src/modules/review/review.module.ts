import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { ReviewApplicationService } from './application/review.application.service';
import { ReviewService } from './domain/review.service';
import { ReviewResponseMapper } from './mappers/review-response.mapper';
import { ReviewController } from './transport/controller/review.controller';
import { ReviewDomainExceptionFilter } from './transport/filters/review-domain-exception.filter';
import { REVIEW_REPOSITORY_PORT } from './domain/ports';
import { ReviewRepository } from './infrastructure/repositories/review.repository';
import { QuizModule } from '@/modules/quiz/quiz.module';

@Module({
  imports: [DatabaseModule, QuizModule],
  providers: [
    // Application
    ReviewApplicationService,

    // Domain
    ReviewService,

    // Mapper
    ReviewResponseMapper,

    // Exception filter
    ReviewDomainExceptionFilter,

    // Port bindings
    { provide: REVIEW_REPOSITORY_PORT, useExisting: ReviewRepository },
  ],
  controllers: [ReviewController],
  exports: [ReviewApplicationService],
})
export class ReviewModule {}
