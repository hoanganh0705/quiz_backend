export const REVIEW_OUTBOX_PORT = Symbol('REVIEW_OUTBOX_PORT');

export type ReviewSubmittedOutboxPayload = {
  quizId: string;

  quizTitle: string;
  quizCreatorId: string;
  reviewId: string;
  userId: string;
  rating: number;
};

export type ReviewDeletedOutboxPayload = {
  quizId: string;
  quizTitle: string;
  quizCreatorId: string;
  reviewId: string;
};

export type ReviewHelpfulChangedOutboxPayload = {
  quizId: string;
  reviewId: string;
  delta: 1 | -1;
};

export interface ReviewOutboxPort {
  scheduleReviewSubmitted(
    payload: ReviewSubmittedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;

  scheduleReviewDeleted(
    payload: ReviewDeletedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;

  scheduleReviewHelpfulChanged(
    payload: ReviewHelpfulChangedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;
}
