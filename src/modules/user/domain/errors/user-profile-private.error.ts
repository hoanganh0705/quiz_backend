import { UserDomainError } from './user-domain.errors';

/**
 * Thrown when a caller attempts to read another user's profile (or related
 * analytics/ranking) but the target profile is private. 403 Forbidden.
 *
 * Lives in a sibling file to `user-domain.errors.ts` because of its
 * specific message signature (takes a `targetUserId` rather than an
 * optional `message`); consolidating it into the main file would not
 * reduce complexity. Re-exported from `./index.ts` so callers import from
 * `@/modules/user/domain/errors` exactly like the other user exceptions.
 *
 * Cross-module note: the achievement module's
 * `AchievementDomainExceptionFilter` (out of scope for Phase 1) also
 * catches `UserProfilePrivateError` to surface it as 403. That filter's
 * `instanceof` check continues to work after Phase 1 because the class
 * identity is preserved. The wire shape from achievement routes remains
 * the old envelope until Phase 2.
 */
export class UserProfilePrivateError extends UserDomainError {
  readonly code = 'USER_PROFILE_PRIVATE';

  constructor(targetUserId: string) {
    super(`Profile of user ${targetUserId} is not public`);
  }
}
