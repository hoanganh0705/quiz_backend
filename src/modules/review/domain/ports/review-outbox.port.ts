/**
 * Review outbox port.
 *
 * Phase 1 / Issue #3 — `ReviewSubmittedEvent` and `ReviewDeletedEvent`
 * are dispatched via an in-memory bus and consumed by the Quiz
 * analytics listener asynchronously. If the application crashes
 * after the review row is committed but before the listener fires,
 * the denormalized `quiz_stats.avg_rating` and `rating_count`
 * counters drift from the source of truth in `quiz_reviews`.
 *
 * The fix is the canonical Transactional Outbox: write the event
 * payload into the existing `outbox_events` table inside the same
 * transaction that mutates `quiz_reviews`, and let a worker drain
 * the table and call the analytics handler. The worker is the same
 * path that already exists for auth/ranking/achievement events
 * (`OutboxProcessorService`); this port gives the Review module a
 * dedicated producer-side API so its writes are not tangled up with
 * other domains.
 */
export const REVIEW_OUTBOX_PORT = Symbol('REVIEW_OUTBOX_PORT');

export type ReviewSubmittedOutboxPayload = {
  quizId: string;
  reviewId: string;
  userId: string;
  rating: number;
};

export type ReviewDeletedOutboxPayload = {
  quizId: string;
  reviewId: string;
};

export interface ReviewOutboxPort {
  /**
   * Schedule a `review.submitted` event to be processed by the
   * outbox worker.
   *
   * The implementation MUST insert the row inside the supplied
   * transaction (`tx`) so the outbox write is atomic with the
   * originating `quiz_reviews` insert. If the transaction rolls
   * back, the outbox row never becomes visible and the worker
   * will not see a phantom event.
   *
   * `tx` is the Drizzle transaction client (typed as `unknown`
   * to avoid leaking the dependency into the port surface; cast
   * at the call site). Pass the same `tx` you are using to
   * insert the review.
   */
  scheduleReviewSubmitted(
    payload: ReviewSubmittedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;

  /**
   * Schedule a `review.deleted` event. Same atomicity guarantees
   * as `scheduleReviewSubmitted`.
   */
  scheduleReviewDeleted(
    payload: ReviewDeletedOutboxPayload,
    tx: unknown,
    nowIso: string,
  ): Promise<void>;
}
