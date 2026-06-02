import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';

@Injectable()
export class AnalyticsEventHandler {
  constructor(
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(AnalyticsEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  async onAttemptCompleted(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshQuizMetrics(quizId);
      this.logger.debug({
        event: 'analytics_attempt_completed',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_attempt_completed_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async onReviewSubmitted(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshReviewMetrics(quizId);
      this.logger.debug({
        event: 'analytics_review_submitted',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_submitted_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async onReviewDeleted(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshReviewMetrics(quizId);
      this.logger.debug({
        event: 'analytics_review_deleted',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_review_deleted_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async onBookmarkAdded(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshBookmarkMetrics(quizId);
      this.logger.debug({
        event: 'analytics_bookmark_added',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_bookmark_added_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async onBookmarkRemoved(quizId: string): Promise<void> {
    try {
      await this.quizAnalyticsService.refreshBookmarkMetrics(quizId);
      this.logger.debug({
        event: 'analytics_bookmark_removed',
        quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'analytics_bookmark_removed_failed',
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
