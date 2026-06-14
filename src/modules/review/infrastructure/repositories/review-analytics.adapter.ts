import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { type ReviewAnalyticsPort } from '@/modules/review/domain/events';
import { ReviewSubmittedEvent, ReviewDeletedEvent } from '@/modules/review/domain/events';
import { QUIZ_ANALYTICS_PORT, type QuizAnalyticsPort } from '@/modules/quiz/domain/analytics';

/**
 * Adapter that routes Review domain events into the Quiz analytics port.
 *
 * Uses {@link QUIZ_ANALYTICS_PORT} (not the concrete `AnalyticsEventHandler` class)
 * so the Review module doesn't reach into Quiz internals. The Quiz module owns
 * `QUIZ_ANALYTICS_PORT` and provides it through its module's providers.
 */
@Injectable()
export class ReviewAnalyticsAdapter implements ReviewAnalyticsPort {
  constructor(
    @Inject(QUIZ_ANALYTICS_PORT)
    private readonly quizAnalyticsService: QuizAnalyticsPort,
    @InjectPinoLogger(ReviewAnalyticsAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  async handleReviewSubmitted(event: ReviewSubmittedEvent): Promise<void> {
    try {
      await this.quizAnalyticsService.onReviewSubmitted(event.payload.quizId);
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_submitted_failed',
        quizId: event.payload.quizId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async handleReviewDeleted(event: ReviewDeletedEvent): Promise<void> {
    try {
      await this.quizAnalyticsService.onReviewDeleted(event.payload.quizId);
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_deleted_failed',
        quizId: event.payload.quizId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
