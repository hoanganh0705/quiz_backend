import type { JwtPayload } from '@/common/guards/jwt.guard';
import { hasPermission, Permission } from '@/common/authorization/permissions';
import { ModeratorRequiredError } from '../errors';

/**
 * CommentAuthorizationPolicy — Authorization assertions for comment moderation.
 *
 * Pure object (no DI). Single source of truth for "can this user moderate comments".
 * Backed by the COMMENT_MODERATE permission; admin and moderator both hold it.
 */
export const CommentAuthorizationPolicy = {
  /**
   * Asserts the user can perform a comment moderation action
   * (hide/restore comments, review reports, list reports).
   * Throws ModeratorRequiredError if assertion fails.
   */
  assertCanModerate(user: Pick<JwtPayload, 'sub' | 'role'>): void {
    if (!hasPermission(user.role, Permission.COMMENT_MODERATE)) {
      throw new ModeratorRequiredError();
    }
  },
};
