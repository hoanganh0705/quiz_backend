import { ReviewSubmittedEvent, ReviewDeletedEvent } from './review-domain.events';

export const REVIEW_ANALYTICS_PORT = Symbol('REVIEW_ANALYTICS_PORT');

export interface ReviewAnalyticsPort {
  handleReviewSubmitted(event: ReviewSubmittedEvent): Promise<void>;
  handleReviewDeleted(event: ReviewDeletedEvent): Promise<void>;
}
