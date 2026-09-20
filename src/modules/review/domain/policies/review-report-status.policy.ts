export type ReviewReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export const REPORT_STATUS_VALUES = [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
] as const satisfies readonly ReviewReportStatus[];

export const REVIEW_REPORT_PLATFORM_STATUS_VALUES = [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
  'all',
] as const;

export const REPORT_REASON_VALUES = [
  'spam',
  'harassment',
  'inappropriate_content',
  'misinformation',
  'other',
] as const;

export type ReviewReportReason = (typeof REPORT_REASON_VALUES)[number];

export const REPORT_REPORT_WRITABLE_STATUSES = ['reviewed', 'dismissed', 'actioned'] as const;

export type ReviewReportWritableStatus = (typeof REPORT_REPORT_WRITABLE_STATUSES)[number];

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_\-:.]+$/;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export const REVIEW_REPORT_TERMINAL_STATUSES: ReadonlySet<ReviewReportStatus> = new Set([
  'reviewed',
  'dismissed',
  'actioned',
]);

const TRANSITIONS: Readonly<Record<ReviewReportStatus, ReadonlySet<ReviewReportStatus>>> = {
  open: new Set<ReviewReportStatus>(['reviewed', 'dismissed', 'actioned']),
  reviewed: new Set<ReviewReportStatus>(),
  dismissed: new Set<ReviewReportStatus>(),
  actioned: new Set<ReviewReportStatus>(),
};

export const ReviewReportStatusPolicy = {
  /**
   * Returns true iff `from → to` is a permitted transition. Terminal
   * statuses return false for every target (including themselves, so
   * `reviewed → reviewed` is also rejected).
   */
  canTransition(from: ReviewReportStatus, to: ReviewReportStatus): boolean {
    if (from === to) {
      // No-op writes are rejected so the audit log cannot be
      // polluted with redundant `status_changed` entries.
      return false;
    }
    return TRANSITIONS[from].has(to);
  },

  isTerminal(status: ReviewReportStatus): boolean {
    return REVIEW_REPORT_TERMINAL_STATUSES.has(status);
  },
} as const;
