/**
 * Review report status state machine.
 *
 * Phase 2 / Issue #38 — `updateReportStatus` previously allowed any
 * status → any status transition. The only legal forward transitions
 * today are:
 *
 *   open → reviewed
 *   open → dismissed
 *   open → actioned
 *
 * `reviewed`, `dismissed`, and `actioned` are terminal. There is no
 * "reopen" path; if a dismissed report needs to be acted on, the
 * reporter should file a new report with new evidence (Issue #16).
 *
 * Why a state machine
 * -------------------
 *
 * Without one, a moderator can flip a report through
 * `open → actioned → dismissed → reviewed → open` arbitrarily. State
 * reverts allow gaming:
 *
 *   - A moderator marks a report `actioned`, the platform auto-removes
 *     the review, the moderator flips the same report back to
 *     `dismissed` to erase the moderation trail.
 *   - A moderator marks a report `dismissed`, then later flips it to
 *     `reviewed` to reuse the row as a different decision, confusing
 *     audit history.
 *
 * Centralizing the transition table in this policy keeps the rule
 * close to the type definition, makes it easy to unit-test, and gives
 * the admin service a single `assertCanTransition` call site.
 */

export type ReviewReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export const REPORT_STATUS_VALUES = [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
] as const satisfies readonly ReviewReportStatus[];

/**
 * Phase 5 / Issue #18 — closed set of `review_reports.reason`
 * values. The previous DTO accepted any free-text string, which
 * meant moderators couldn't reliably group reports and a typo'd
 * reason reached Postgres as a 23514 check violation (500). The
 * closed set below lets the moderation dashboard compute "reports
 * tagged `spam` today" without text mining and lets the API
 * surface a clean 400 on a typo.
 *
 * `details` remains free-text; `reason` is the structured tag.
 */
export const REPORT_REASON_VALUES = [
  'spam',
  'harassment',
  'inappropriate_content',
  'misinformation',
  'other',
] as const;

export type ReviewReportReason = (typeof REPORT_REASON_VALUES)[number];

/**
 * Phase 4 / Issue #36 — the moderator-list filter extends the four
 * concrete statuses with an `'all'` sentinel that bypasses the
 * default `open` filter. `'all'` is controller-only; the
 * repository never sees it because the controller maps it to a
 * `null` filter. Keeping the sentinel out of `REPORT_STATUS_VALUES`
 * preserves the invariant that the user-facing report-status
 * filter can never carry the `'all'` value (it has no meaning
 * against the user-reported-reviews endpoint).
 */
export const REVIEW_REPORT_PLATFORM_STATUS_VALUES = [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
  'all',
] as const;

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
