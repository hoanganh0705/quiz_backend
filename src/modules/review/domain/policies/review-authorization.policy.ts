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

const ADMIN_ROLE = 'admin';

function isAdmin(actor: ReviewActor): boolean {
  return actor.role === ADMIN_ROLE;
}

export const ReviewAuthorizationPolicy = {
  canModify(actor: ReviewActor, target: ReviewTarget): boolean {
    return target.userId === actor.sub || isAdmin(actor);
  },

  canViewAnalytics(actor: ReviewActor, target: ReviewQuizTarget): boolean {
    return target.creatorId === actor.sub || isAdmin(actor);
  },
} as const;
