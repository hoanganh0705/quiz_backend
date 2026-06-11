import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { type ReviewAnalyticsPort } from '@/modules/review/domain/events';
import { ReviewSubmittedEvent, ReviewDeletedEvent } from '@/modules/review/domain/events';
import { AnalyticsEventHandler } from '@/modules/quiz/domain/analytics/analytics-event-handler';

@Injectable()
export class ReviewAnalyticsAdapter implements ReviewAnalyticsPort {
  constructor(
    @Inject(forwardRef(() => AnalyticsEventHandler))
    private readonly analyticsEventHandler: AnalyticsEventHandler,
    @InjectPinoLogger(ReviewAnalyticsAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  async handleReviewSubmitted(event: ReviewSubmittedEvent): Promise<void> {
    try {
      await this.analyticsEventHandler.onReviewSubmitted(event.payload.quizId);
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
      await this.analyticsEventHandler.onReviewDeleted(event.payload.quizId);
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
