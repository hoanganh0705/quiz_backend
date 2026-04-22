import { QuizVersionStatus } from './types/quiz.types';

type EditQuizVersionArgs = {
  status: QuizVersionStatus;
  isOwner: boolean;
  canEditAny: boolean;
  canEditOwn: boolean;
};

type PublishQuizVersionArgs = {
  status: QuizVersionStatus;
  isOwner: boolean;
  canPublishAny: boolean;
  canPublishOwn: boolean;
  quizIsVerified: boolean;
  quizIsHidden: boolean;
  canVerify: boolean;
};

type ManageOwnOrAnyArgs = {
  isOwner: boolean;
  canManageAny: boolean;
  canManageOwn: boolean;
};

export const canManageOwnOrAny = ({
  isOwner,
  canManageAny,
  canManageOwn,
}: ManageOwnOrAnyArgs): boolean => {
  if (canManageAny) return true;
  return canManageOwn && isOwner;
};

export const canEditQuizVersion = ({
  status,
  isOwner,
  canEditAny,
  canEditOwn,
}: EditQuizVersionArgs): boolean => {
  if (status !== 'draft') {
    return false;
  }

  return canManageOwnOrAny({ isOwner, canManageAny: canEditAny, canManageOwn: canEditOwn });
};

export const canPublishQuizVersion = ({
  status,
  isOwner,
  canPublishAny,
  canPublishOwn,
  quizIsVerified,
  quizIsHidden,
  canVerify,
}: PublishQuizVersionArgs): boolean => {
  if (status !== 'draft') {
    return false;
  }

  // Publishing hidden/unverified quizzes requires moderation permission.
  if ((!quizIsVerified || quizIsHidden) && !canVerify) {
    return false;
  }

  return canManageOwnOrAny({
    isOwner,
    canManageAny: canPublishAny,
    canManageOwn: canPublishOwn,
  });
};
