import { hasPermission, Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { QuizVersionStatus } from '../../types/quiz.types';
import { QuizForbiddenError, QuizValidationError, QuizVersionImmutableError } from '../errors';
import {
  canEditQuizVersion,
  canManageOwnOrAny,
  canPublishQuizVersion,
} from '../../authz/quiz-authorization.helper';

/**
 * Pure, stateless transition guards for the quiz version lifecycle.
 *
 * Lifecycle: draft → published → archived
 *
 * Rules:
 *  - Only `draft` versions can be edited or published.
 *  - `published` versions are immutable; they can only be superseded by creating a new draft.
 *  - `archived` versions are immutable; they cannot be edited or published.
 *  - Publishing requires a sufficient question count (enforced by the caller).
 *  - Publishing hidden/unverified quizzes requires the QUIZ_VERIFY permission.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditTransitionResult = 'edit' | 'draft-from-published';

export type VersionOwnershipContext = {
  creatorId: string | null;
  user: JwtPayload;
};

export type PublishPermissionContext = {
  isOwner: boolean;
  quizIsVerified: boolean;
  quizIsHidden: boolean;
  user: JwtPayload;
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Asserts the version can be deleted or is immutable (archived).
 * Returns 'edit' for draft edits, 'draft-from-published' for published rewrites.
 * Throws domain errors on all invalid transitions.
 */
export function assertCanEditOrDraftFrom(
  status: QuizVersionStatus,
  isOwner: boolean,
  user: JwtPayload,
): EditTransitionResult {
  const canEditOwn = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_OWN);
  const canEditAny = hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_ANY);

  if (status === 'archived') {
    throw new QuizVersionImmutableError('Archived versions are immutable and cannot be edited');
  }

  if (status === 'published') {
    const canCreateDraft = canManageOwnOrAny({
      isOwner,
      canManageAny: canEditAny,
      canManageOwn: canEditOwn,
    });
    if (!canCreateDraft) {
      throw new QuizForbiddenError(
        'You do not have permission to create a draft from this version',
      );
    }
    return 'draft-from-published';
  }

  // status === 'draft'
  if (!canEditQuizVersion({ status, isOwner, canEditAny, canEditOwn })) {
    throw new QuizForbiddenError('Only draft versions can be edited');
  }

  return 'edit';
}

/**
 * Asserts a draft version can be published by the given user.
 * Throws domain errors for immutable states and forbidden transitions.
 */
export function assertCanPublish(
  status: QuizVersionStatus,
  isOwner: boolean,
  user: JwtPayload,
  quizIsVerified: boolean,
  quizIsHidden: boolean,
): void {
  if (status === 'archived') {
    throw new QuizVersionImmutableError('Archived versions cannot be published');
  }

  if (status !== 'draft') {
    throw new QuizValidationError('Only draft versions can be published');
  }

  const canPublish = canPublishQuizVersion({
    status,
    isOwner,
    canPublishAny: hasPermission(user.role, Permission.QUIZ_VERSION_PUBLISH_ANY),
    canPublishOwn: hasPermission(user.role, Permission.QUIZ_VERSION_PUBLISH_OWN),
    quizIsVerified,
    quizIsHidden,
    canVerify: hasPermission(user.role, Permission.QUIZ_VERIFY),
  });

  if (!canPublish) {
    throw new QuizForbiddenError('You do not have permission to publish this quiz version');
  }
}

/**
 * Returns true when the version status is terminal (cannot be mutated).
 */
export function isVersionImmutable(status: QuizVersionStatus): boolean {
  return status === 'archived';
}

/**
 * Returns true when publishing is already a no-op (already published).
 */
export function isAlreadyPublished(status: QuizVersionStatus): boolean {
  return status === 'published';
}
