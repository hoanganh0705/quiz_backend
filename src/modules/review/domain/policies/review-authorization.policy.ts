export type ReviewActor = {
  sub: string;
  role: string;
};

export type ReviewTarget = {
  reviewId: string;
  userId: string;
};

export type ReviewQuizTarget = {
  quizId: string;
  creatorId: string | null;
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
    return target.userId === actor.sub || actor.role === 'admin';
  },

  canViewAnalytics(actor: ReviewActor, target: ReviewQuizTarget): boolean {
    return target.creatorId === actor.sub || actor.role === 'admin';
  },
} as const;
