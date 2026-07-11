import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Achievement-module namespace marker for achievement-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, review, bookmark, instance, and social
 * modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new AchievementDomainError' src/` returns no matches.
 *
 * Cross-module note (also recorded on `UserProfilePrivateError`): the prior
 * per-module filter `@Catch(AchievementDomainError, UserProfilePrivateError)`
 * also caught the cross-module `UserProfilePrivateError` from the user
 * module. After Phase 2 the achievement filter is removed; the global
 * filter handles both via `ProblemCodeMapping['USER_PROFILE_PRIVATE']`
 * (declared in Phase 1).
 */
export abstract class AchievementDomainError extends BaseDomainException {}

/**
 * Thrown when a badge lookup fails (no badge matches the given
 * identifier). 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `BadgeNotFoundError.message` to a hardcoded generic
 * `'Badge not found'`. The global filter now preserves
 * `exception.message` (default format: `'Badge not found: <badgeId>'`,
 * with the ID interpolated from the constructor argument).
 */
export class BadgeNotFoundError extends AchievementDomainError {
  readonly code = 'BADGE_NOT_FOUND';
  readonly context: { readonly badgeId: string };
  constructor(badgeId: string) {
    super(`Badge not found: ${badgeId}`);
    this.context = { badgeId };
  }
}

/**
 * Thrown when the achievement rule engine fails to grant a badge to a
 * user for an internal reason (corrupted grant record, database
 * deadlock, etc.). 500 Internal Server Error.
 *
 * Wire-shape improvement: the prior per-module filter had NO branch
 * for `AchievementGrantError` in its `mapToHttp` — the class fell
 * through to the catch-all and was returned as `500 Internal Server
 * Error` with a hardcoded generic message
 * `'Internal server error'` (the thrown message and `context` were
 * both discarded). The global filter now resolves the code correctly
 * and preserves the thrown message (default format:
 * `'Failed to grant achievement for user <userId>: <reason>'`,
 * with both interpolated from the constructor arguments).
 *
 * Note: this exception is defined and exported but is currently NOT
 * thrown by `achievement.application.service.ts` (audit at rev4.7
 * completion: 0 grep hits). It is kept here as documentation /
 * forward-compatibility — the global filter will resolve the code
 * correctly if a future call site throws it.
 */
export class AchievementGrantError extends AchievementDomainError {
  readonly code = 'ACHIEVEMENT_GRANT_ERROR';
  readonly context: { readonly userId: string; readonly reason: string };
  constructor(userId: string, reason: string) {
    super(`Failed to grant achievement for user ${userId}: ${reason}`);
    this.context = { userId, reason };
  }
}

/**
 * Thrown when a user lookup fails during an achievement operation.
 * 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `AchievementUserNotFoundError.message` to a hardcoded generic
 * `'User not found'`. The global filter now preserves
 * `exception.message` (default format: `'User not found: <userId>'`,
 * with the ID interpolated from the constructor argument).
 */
export class AchievementUserNotFoundError extends AchievementDomainError {
  readonly code = 'ACHIEVEMENT_USER_NOT_FOUND';
  readonly context: { readonly userId: string };
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.context = { userId };
  }
}

/**
 * Thrown when the user does not own the badge they are trying to act
 * on (revoke, progress-check, etc.). 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `UserBadgeOwnershipNotFoundError.message` to a hardcoded generic
 * `'User badge not found'`. The global filter now preserves
 * `exception.message` (default format:
 * `'Badge <badgeId> not owned by user <userId>'`, with both IDs
 * interpolated from the constructor arguments).
 */
export class UserBadgeOwnershipNotFoundError extends AchievementDomainError {
  readonly code = 'USER_BADGE_OWNERSHIP_NOT_FOUND';
  readonly context: { readonly userId: string; readonly badgeId: string };
  constructor(userId: string, badgeId: string) {
    super(`Badge ${badgeId} not owned by user ${userId}`);
    this.context = { userId, badgeId };
  }
}
