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
  authorUserId: string;
  reporterUserId: string;
};

export type ReviewQuizTarget = {
  quizId: string;
  creatorId: string | null;
};

export type ReviewQuizVisibility = {
  quizId: string;
  isHidden: boolean;
  publishedVersionId: string | null;
};

export const ReviewAuthorizationPolicy = {
  canModify(actor: ReviewActor, target: ReviewTarget): boolean {
    if (target.userId === actor.sub) return true;
    return hasPermission(actor.role, Permission.REVIEW_MODERATE);
  },

  canViewAnalytics(actor: ReviewActor, target: ReviewQuizTarget): boolean {
    if (target.creatorId === actor.sub) return true;
    return hasPermission(actor.role, Permission.REVIEW_MODERATE);
  },

  isVisibleToReviewers(quiz: ReviewQuizVisibility | null): boolean {
    if (!quiz) return false;
    if (quiz.isHidden) return false;
    if (quiz.publishedVersionId === null) return false;
    return true;
  },

  canReport(subject: ReviewReportSubject): boolean {
    return subject.authorUserId !== subject.reporterUserId;
  },
} as const;
