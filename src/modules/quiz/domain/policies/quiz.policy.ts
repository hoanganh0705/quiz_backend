import type { JwtPayload } from '@/common/guards/jwt.guard';
import { hasPermission, Permission } from '@/common/authorization/permissions';
import { QuizForbiddenError } from '../errors';

/**
 * QuizPolicy — Authorization assertions for Quiz aggregate operations.
 *
 * Pure object (no DI). Replaces inline ownership checks scattered across services.
 * Authorization decisions are expressed against the `Permission` enum; role-based
 * bypasses (`user.role === 'admin'`) are no longer the source of truth.
 */
export const QuizPolicy = {
  /**
   * Asserts the user can create a new quiz.
   * Currently allows any authenticated user to create quizzes.
   * Throws QuizForbiddenError if assertion fails.
   */

  assertCanCreate(_user: JwtPayload): void {
    // Any authenticated user can create a quiz (no restrictions currently)
  },

  /**
   * Asserts the user can edit a quiz.
   * The quiz owner or any holder of `QUIZ_EDIT_ANY` can edit.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanEdit(quizCreatorId: string | null, user: JwtPayload): void {
    const isOwner = !!quizCreatorId && quizCreatorId === user.sub;
    const canEditAny = hasPermission(user.role, Permission.QUIZ_EDIT_ANY);

    if (!isOwner && !canEditAny) {
      throw new QuizForbiddenError('You do not have permission to manage this quiz');
    }
  },

  /**
   * Asserts the user can delete a quiz.
   * Same rules as edit: owner or any holder of `QUIZ_DELETE_ANY`.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanDelete(quizCreatorId: string | null, user: JwtPayload): void {
    const isOwner = !!quizCreatorId && quizCreatorId === user.sub;
    const canDeleteAny = hasPermission(user.role, Permission.QUIZ_DELETE_ANY);

    if (!isOwner && !canDeleteAny) {
      throw new QuizForbiddenError('You do not have permission to delete this quiz');
    }
  },

  /**
   * Returns true if the user owns this quiz.
   */
  isOwner(quizCreatorId: string | null, user: JwtPayload): boolean {
    return !!quizCreatorId && quizCreatorId === user.sub;
  },
};
