import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizForbiddenError } from '../errors';

/**
 * QuizPolicy — Authorization assertions for Quiz aggregate operations.
 *
 * Pure object (no DI). Replaces inline ownership checks scattered across services.
 */
export const QuizPolicy = {
  /**
   * Asserts the user can create a new quiz.
   * Currently allows any authenticated user to create quizzes.
   * Throws QuizForbiddenError if assertion fails.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assertCanCreate(_user: JwtPayload): void {
    // Any authenticated user can create a quiz (no restrictions currently)
  },

  /**
   * Asserts the user can edit a quiz.
   * Only the quiz owner or admin can edit.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanEdit(quizCreatorId: string | null, user: JwtPayload): void {
    const isOwner = !!quizCreatorId && quizCreatorId === user.sub;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new QuizForbiddenError('You do not have permission to manage this quiz');
    }
  },

  /**
   * Asserts the user can delete a quiz.
   * Same rules as edit: only owner or admin.
   * Throws QuizForbiddenError if assertion fails.
   */
  assertCanDelete(quizCreatorId: string | null, user: JwtPayload): void {
    QuizPolicy.assertCanEdit(quizCreatorId, user);
  },

  /**
   * Returns true if the user owns this quiz.
   */
  isOwner(quizCreatorId: string | null, user: JwtPayload): boolean {
    return !!quizCreatorId && quizCreatorId === user.sub;
  },
};
