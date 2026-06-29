import type { JwtPayload } from '@/common/guards/jwt.guard';
import { hasPermission, Permission } from '@/common/authorization/permissions';
import { ModeratorRequiredError } from '../errors';

/**
 * DiscussionAuthorizationPolicy — Authorization assertions for discussion moderation.
 *
 * Pure object (no DI). Single source of truth for "can this user moderate discussions".
 * Backed by the DISCUSSION_MODERATE permission; admin and moderator both hold it.
 */
export const DiscussionAuthorizationPolicy = {
  /**
   * Asserts the user can perform a discussion moderation action
   * (hide/restore threads, hide/restore comments, review reports, list reports).
   * Throws ModeratorRequiredError if assertion fails.
   */
  assertCanModerate(user: Pick<JwtPayload, 'sub' | 'role'>): void {
    if (!hasPermission(user.role, Permission.DISCUSSION_MODERATE)) {
      throw new ModeratorRequiredError();
    }
  },
};
