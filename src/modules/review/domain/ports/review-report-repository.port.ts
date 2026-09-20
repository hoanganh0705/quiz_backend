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
  quizId: string | null;
  quizTitle: string | null;
  reviewerUsername: string | null;
  rating: number | null;
  comment: string | null;
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

  getReportStatus(reportId: string): Promise<ReviewReportRow['status'] | null>;

  updateReportStatusIfCurrent(params: {
    reportId: string;
    currentStatus: ReviewReportRow['status'];
    newStatus: 'reviewed' | 'dismissed' | 'actioned';
    nowIso: string;
    tx?: unknown;
  }): Promise<boolean>;

  getReportReviewId(reportId: string, tx?: unknown): Promise<string | null>;
}

export const REVIEW_REPORT_REPOSITORY_PORT = Symbol('REVIEW_REPORT_REPOSITORY_PORT');
