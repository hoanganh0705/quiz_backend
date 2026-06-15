/**
 * Review Notification Listener
 *
 * Subscribes to Review domain events and dispatches notifications to quiz creators
 * via ReviewNotificationService.
 *
 * Registered in NotificationModule.onModuleInit and unsubscribed on destroy.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  REVIEW_DOMAIN_EVENT_BUS,
  type PublishedReviewDomainEvent,
} from '@/modules/review/domain/events';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports/quiz-repository.port';
import type { QuizRepositoryPort } from '@/modules/quiz/domain/ports/quiz-repository.port';
import { ReviewNotificationService } from '../../domain/services/review-notification.service';

@Injectable()
export class ReviewNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => REVIEW_DOMAIN_EVENT_BUS))
    private readonly reviewEventBus: {
      subscribe(handler: (event: PublishedReviewDomainEvent) => void): () => void;
    },
    @Inject(forwardRef(() => QUIZ_REPOSITORY_PORT))
    private readonly quizRepository: QuizRepositoryPort,
    private readonly reviewNotificationService: ReviewNotificationService,
    @InjectPinoLogger(ReviewNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): void {
    this.unsubscribe = this.reviewEventBus.subscribe((event: PublishedReviewDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'review_notification_listener_subscribed',
    });
  }

  private async handleEvent(event: PublishedReviewDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'review.submitted':
        await this.handleReviewSubmitted(event);
        break;

      case 'review.deleted':
        await this.handleReviewDeleted(event);
        break;
    }
  }

  private async handleReviewSubmitted(
    event: Extract<PublishedReviewDomainEvent, { eventType: 'review.submitted' }>,
  ): Promise<void> {
    try {
      const quiz = await this.quizRepository.getQuizWithPublishedVersionById(event.payload.quizId);
      if (!quiz || !quiz.creatorId) {
        this.logger.warn({
          event: 'review_notification_no_quiz_creator',
          quizId: event.payload.quizId,
        });
        return;
      }

      await this.reviewNotificationService.notifyReviewSubmitted({
        quizCreatorId: quiz.creatorId,
        quizTitle: quiz.title,
        quizId: event.payload.quizId,
        reviewerId: event.payload.userId,
        reviewerUsername: 'Anonymous',
        rating: event.payload.rating,
        hasComment: false,
      });
    } catch (error) {
      this.logger.error({
        event: 'review_submitted_notification_failed',
        quizId: event.payload.quizId,
        reviewerId: event.payload.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleReviewDeleted(
    event: Extract<PublishedReviewDomainEvent, { eventType: 'review.deleted' }>,
  ): Promise<void> {
    try {
      const quiz = await this.quizRepository.getQuizWithPublishedVersionById(event.payload.quizId);
      if (!quiz || !quiz.creatorId) {
        this.logger.warn({
          event: 'review_deleted_notification_no_quiz_creator',
          quizId: event.payload.quizId,
        });
        return;
      }

      await this.reviewNotificationService.notifyReviewDeleted({
        quizCreatorId: quiz.creatorId,
        quizTitle: quiz.title,
        quizId: event.payload.quizId,
      });
    } catch (error) {
      this.logger.error({
        event: 'review_deleted_notification_failed',
        quizId: event.payload.quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
