/**
 * Review Notification Service
 *
 * Composes and sends notifications related to quiz reviews.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface ReviewSubmittedParams {
  quizCreatorId: string;
  quizCreatorUsername?: string;
  quizTitle: string;
  quizId: string;
  reviewerId: string;
  reviewerUsername: string;
  rating: number;
  hasComment: boolean;
}

export interface ReviewDeletedParams {
  quizCreatorId: string;
  quizCreatorUsername?: string;
  quizTitle: string;
  quizId: string;
}

@Injectable()
export class ReviewNotificationService {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(ReviewNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Notify the quiz creator when their quiz receives a new review.
   */
  async notifyReviewSubmitted(params: ReviewSubmittedParams): Promise<void> {
    if (params.quizCreatorId === params.reviewerId) {
      this.logger.debug({
        event: 'review_notification_skipped_self_review',
        quizId: params.quizId,
        creatorId: params.quizCreatorId,
        reviewerId: params.reviewerId,
      });
      return;
    }

    const commentNote = params.hasComment ? ' (with comment)' : '';
    const body = `${params.reviewerUsername ?? 'Someone'} left a ${params.rating}-star review${commentNote} on "${params.quizTitle}"`;

    await this.channelService.send({
      userId: params.quizCreatorId,
      type: 'quiz_review_received',
      title: 'New Review on Your Quiz',
      body,
      metadata: {
        quizId: params.quizId,
        reviewerId: params.reviewerId,
        reviewerUsername: params.reviewerUsername,
        rating: params.rating,
        hasComment: params.hasComment,
      },
    });

    this.logger.info({
      event: 'quiz_review_notification_sent',
      quizId: params.quizId,
      creatorId: params.quizCreatorId,
      reviewerId: params.reviewerId,
      rating: params.rating,
    });
  }

  /**
   * Optionally notify the quiz creator when a review is deleted.
   */
  async notifyReviewDeleted(params: ReviewDeletedParams): Promise<void> {
    const body = `A review on your quiz "${params.quizTitle}" was deleted`;

    await this.channelService.send({
      userId: params.quizCreatorId,
      type: 'quiz_review_received',
      title: 'Review Removed from Your Quiz',
      body,
      metadata: {
        quizId: params.quizId,
      },
    });

    this.logger.info({
      event: 'quiz_review_deleted_notification_sent',
      quizId: params.quizId,
      creatorId: params.quizCreatorId,
    });
  }
}
