export type ReviewReportRow = {
  reportId: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export type ReportedReviewRow = {
  reportId: string;
  reviewId: string;
  // Phase 4 / Issue #35 — fields joined from `quiz_reviews` /
  // `quizzes` / `users` are nullable because the underlying review
  // can be cascade-deleted while the report row remains. The user
  // still needs to see "report against [deleted review]" rather
  // than a missing list entry.
  quizId: string | null;
  quizTitle: string | null;
  reviewerUsername: string | null;
  rating: number | null;
  comment: string | null;
  // Phase 5 / Issue #18 — narrowed to the closed-set tag.
  reason: import('../../domain/policies/review-report-status.policy').ReviewReportReason;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export type PlatformReportRow = {
  reportId: string;
  reviewId: string;
  quizId: string;
  quizTitle: string;
  reviewerUsername: string;
  reportedUserId: string;
  rating: number;
  comment: string | null;
  // Phase 5 / Issue #18 — DB stores `reason` as `text` but the
  // structured type carries the closed-set tag. The repository
  // narrows it on read; the response mapper passes it through.
  reason: import('../../domain/policies/review-report-status.policy').ReviewReportReason;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
  updatedAt: string;
};

export type ReportCursor = {
  createdAt: string;
  reportId: string;
};

export interface ReviewReportRepositoryPort {
  hasUserReportedReview(reviewId: string, reporterId: string): Promise<boolean>;

  listReportedReviews(params: {
    reporterId: string;
    limit: number;
    cursor?: ReportCursor | null;
    status?: import('../../domain/policies/review-report-status.policy').ReviewReportStatus | null;
  }): Promise<ReportedReviewRow[]>;

  createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow>;

  listPlatformReports(params: {
    limit: number;
    cursor?: { createdAt: string; reportId: string } | null;
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
  }): Promise<PlatformReportRow[]>;

  updateReportStatus(params: {
    reportId: string;
    status: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
  }): Promise<void>;

  /**
   * Phase 2 / Issue #38 — fetch the current status of a report by id.
   * Returns `null` if the report does not exist. The admin service
   * uses this to drive the state machine check
   * (`ReviewReportStatusPolicy.canTransition`); the value is read
   * inside the same transaction as the status update so a concurrent
   * transition cannot race past the policy.
   */
  getReportStatus(reportId: string): Promise<ReviewReportRow['status'] | null>;

  /**
   * Phase 2 / Issue #38 — like `updateReportStatus` but additionally
   * returns the previous status. The admin service uses the previous
   * status to drive the state-machine transition check
   * atomically; the alternative (read-then-write) would race when
   * two moderators act on the same report simultaneously.
   */
  updateReportStatusIfCurrent(params: {
    reportId: string;
    currentStatus: ReviewReportRow['status'];
    newStatus: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
    // Phase 5 / Issue #37 — optional transaction executor. When
    // provided, the UPDATE runs inside the caller's open
    // transaction so the audit-row INSERT (in
    // `AuditLogService.recordWithExecutor`) and the status
    // UPDATE commit atomically.
    tx?: unknown;
  }): Promise<boolean>;

  /**
   * Phase 5 / Issue #39 — fetch the review id associated with a
   * report. The admin service uses this inside the actioned-status
   * transition so the soft-delete runs against the same row the
   * status UPDATE just modified, and against the same `tx` the
   * caller already opened (so all three writes — the status flip,
   * the soft-delete, and the audit row — commit atomically).
   *
   * Returns `null` when the report id does not exist.
   */
  getReportReviewId(reportId: string, tx?: unknown): Promise<string | null>;
}

export const REVIEW_REPORT_REPOSITORY_PORT = Symbol('REVIEW_REPORT_REPOSITORY_PORT');
