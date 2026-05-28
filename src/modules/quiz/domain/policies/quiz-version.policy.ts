import { hasPermission, Permission } from '@/common/authorization/permissions';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { QuizVersionStatus } from '../../types/quiz.types';
import { QuizForbiddenError, QuizValidationError } from '../errors';
import {
  canManageOwnOrAny,
  canEditQuizVersion,
  canPublishQuizVersion,
} from '../../authz/quiz-authorization.helper';

/**
 * Result of a version status transition check.
 * - 'edit': The version can be edited directly (it's a draft)
 * - 'draft-from-published': The version is published and edits require creating a new draft copy
 * - 'blocked': The user does not have permission to edit this version
 */
export type EditTransitionResult = 'edit' | 'draft-from-published' | 'blocked';

/**
 * QuizVersionPolicy — Authorization and state transition assertions for QuizVersion aggregate.
 *
 * Pure object (no DI). Combines permission checks with state machine logic.
 */
export const QuizVersionPolicy = {
  /**
   * Asserts the user can view quiz versions for a quiz.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanView(isOwner: boolean, user: JwtPayload): void {
    const canView = canManageOwnOrAny({
      isOwner,
      canManageAny: hasPermission(user.role, Permission.QUIZ_VERSION_VIEW_ANY),
      canManageOwn: hasPermission(user.role, Permission.QUIZ_VERSION_VIEW_OWN),
    });

    if (!canView) {
      throw new QuizForbiddenError('You do not have permission to view quiz versions');
    }
  },

  /**
   * Asserts the user can create a new version for a quiz.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanCreate(isOwner: boolean, user: JwtPayload): void {
    const canCreate = canManageOwnOrAny({
      isOwner,
      canManageAny: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_ANY),
      canManageOwn: hasPermission(user.role, Permission.QUIZ_VERSION_CREATE_OWN),
    });

    if (!canCreate) {
      throw new QuizForbiddenError('You do not have permission to manage this quiz');
    }
  },

  /**
   * Checks what edit transition is available for a version.
   * Returns 'blocked' if the user cannot edit at all.
   */
  getEditTransition(
    status: QuizVersionStatus,
    isOwner: boolean,
    user: JwtPayload,
  ): EditTransitionResult {
    const canEdit = canEditQuizVersion({
      status,
      isOwner,
      canEditAny: hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_ANY),
      canEditOwn: hasPermission(user.role, Permission.QUIZ_VERSION_EDIT_OWN),
    });

    if (canEdit) {
      return 'edit';
    }

    // If the version is published, the user can create a draft-from-published transition
    if (status === 'published') {
      return 'draft-from-published';
    }

    return 'blocked';
  },

  /**
   * Asserts the user can edit a quiz version.
   * Throws QuizValidationError if the version is not a draft.
   * Throws QuizForbiddenError if the user lacks permission.
   */
  assertCanEdit(status: QuizVersionStatus, isOwner: boolean, user: JwtPayload): void {
    const transition = QuizVersionPolicy.getEditTransition(status, isOwner, user);

    if (transition === 'blocked') {
      throw new QuizForbiddenError('You do not have permission to edit this quiz version');
    }

    // draft-from-published is allowed for version editing (creates new draft)
    // Nothing to throw here for 'edit' or 'draft-from-published'
  },

  /**
   * Asserts the user can publish a quiz version.
   * Throws QuizValidationError if the version is not a draft.
   * Throws QuizForbiddenError if the user lacks permission or the quiz doesn't meet publish criteria.
   */
  assertCanPublish(
    status: QuizVersionStatus,
    isOwner: boolean,
    user: JwtPayload,
    quizIsVerified: boolean,
    quizIsHidden: boolean,
  ): void {
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
  },

  /**
   * Asserts the user can add questions to a quiz version.
   * Same rules as edit: version must be a draft and user must have edit permission.
   * Throws appropriate errors if assertion fails.
   */
  assertCanAddQuestions(status: QuizVersionStatus, isOwner: boolean, user: JwtPayload): void {
    QuizVersionPolicy.assertCanEdit(status, isOwner, user);
  },
};
