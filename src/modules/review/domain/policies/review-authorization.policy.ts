import { hasPermission, Permission, type UserRole } from '@/common/authorization/permissions';

export type ReviewActor = {
  sub: string;
  role: UserRole;
};

export type ReviewTarget = {
  reviewId: string;
  userId: string;
};

export type ReviewReportSubject = {
  reviewId: string;
  // Author of the review — used to enforce the "you cannot report
  // your own review" invariant.
  authorUserId: string;
  reporterUserId: string;
};

export type ReviewQuizTarget = {
  quizId: string;
  creatorId: string | null;
};

/**
 * Subset of `QuizRecordRow` that the review module needs to make a
 * visibility decision. Kept as a structural type so the repo can
 * return more columns than the policy consumes.
 */
export type ReviewQuizVisibility = {
  quizId: string;
  isHidden: boolean;
  publishedVersionId: string | null;
};

/**
 * Defense-in-depth authorization for review mutations and analytics reads.
 *
 * NOTE: Authorization decisions are made by PermissionsGuard at the controller layer.
 * These checks are defense-in-depth and intentionally remain behind the guard so
 * direct callers (background jobs, future internal use) cannot bypass them.
 * See docs/authorization-rbac-review.md Phase 5.
 */
export const ReviewAuthorizationPolicy = {
  canModify(actor: ReviewActor, target: ReviewTarget): boolean {
    if (target.userId === actor.sub) return true;
    return hasPermission(actor.role, Permission.REVIEW_MODERATE);
  },

  canViewAnalytics(actor: ReviewActor, target: ReviewQuizTarget): boolean {
    if (target.creatorId === actor.sub) return true;
    return hasPermission(actor.role, Permission.REVIEW_MODERATE);
  },

  /**
   * Phase 1 / Issue #1 + #25 — guard quiz-level visibility for review
   * operations. A quiz is reviewable iff:
   *
   *   - it is not soft-deleted (caller's responsibility — the repo
   *     already filters `deleted_at IS NULL`),
   *   - `isHidden === false`, and
   *   - `publishedVersionId !== null`.
   *
   * Hidden or unpublished assets are off-limits to all review
   * operations: creation, listing, helpful votes, reports, analytics.
   * Returning `null` means "use the default (not visible)"; callers
   * should throw `ReviewNotFoundError` to avoid leaking existence.
   */
  isVisibleToReviewers(quiz: ReviewQuizVisibility | null): boolean {
    if (!quiz) return false;
    if (quiz.isHidden) return false;
    if (quiz.publishedVersionId === null) return false;
    return true;
  },

  /**
   * Self-report guard.
   *
   * Returns `true` when the caller is allowed to file a report against
   * the given review, `false` when they are the review's author.
   *
   * The previous shape lived inline in `ReviewService.reportReview` as
   * `review.userId === reporterId`. That ad-hoc check was easy to
   * miss in code review and was never tested at the integration layer,
   * so a regression could let an admin (or any role) self-report and
   * pollute the moderation queue. Centralizing the rule here makes
   * the invariant explicit and gives us one place to add a unit spec
   * for it.
   *
   * Note: the role of the actor does NOT bypass this guard. Even an
   * admin cannot self-report — the moderation queue should not be
   * polluted by self-reports, and the per-review moderation tools
   * (`PATCH /admin/reviews/reports/:reportId` → `actioned`) are the
   * correct path for taking down a review the admin authored.
   */
  canReport(subject: ReviewReportSubject): boolean {
    return subject.authorUserId !== subject.reporterUserId;
  },
} as const;
