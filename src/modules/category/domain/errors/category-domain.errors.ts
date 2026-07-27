import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Category-module namespace marker for category-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, and user
 * modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. (The quiz
 * module has `QuizOperationFailedError` for this; the category module
 * does not need one because no repository in this module currently throws
 * a generic "unexpected DB error" — every thrown site uses a specific
 * subclass.) Audit: `grep -rn 'new CategoryDomainError' src/`
 * returns no matches.
 */
export abstract class CategoryDomainError extends BaseDomainException {}

/**
 * Thrown by category read paths (`CategoryDomainService`,
 * `CategoryController` GETs) when a category cannot be found by id or
 * slug. 404 Not Found.
 */
export class CategoryNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_NOT_FOUND';
  constructor(message = 'Category not found') {
    super(message);
  }
}

/**
 * Thrown by `CategoryQueryService` when a category's analytics entry
 * cannot be found. 404 Not Found.
 */
export class CategoryAnalyticsNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_ANALYTICS_NOT_FOUND';
  constructor(message = 'Category analytics not found') {
    super(message);
  }
}

/**
 * Thrown by `CategoryRepository` when a unique-slug constraint is
 * violated on insert/update. 409 Conflict.
 */
export class CategorySlugConflictError extends CategoryDomainError {
  readonly code = 'CATEGORY_SLUG_CONFLICT';
  constructor(message = 'A category with this slug already exists') {
    super(message);
  }
}

/**
 * Thrown by `CategoryDomainService` when restoring a category that is
 * already active (the restore endpoint refuses to touch active rows).
 * 409 Conflict.
 */
export class CategoryAlreadyActiveError extends CategoryDomainError {
  readonly code = 'CATEGORY_ALREADY_ACTIVE';
  constructor(message = 'Category is already active and cannot be restored') {
    super(message);
  }
}

/**
 * Thrown by `CategoryDomainService` when the restore state machine
 * reaches an invariant violation that shouldn't be reachable in normal
 * flow (corrupted state). 500 Internal Server Error.
 *
 * The prior per-module filter mapped this to 500 with a generic
 * `message: 'Internal server error'`. After Phase 2 the detail field
 * surfaces the concrete message (`'Category restore invariant
 * violated'`) — a wire-shape improvement documented in the plan's
 * v4.0 revision history entry.
 */
export class CategoryRestoreInvariantError extends CategoryDomainError {
  readonly code = 'CATEGORY_RESTORE_INVARIANT';
  constructor(message = 'Category restore invariant violated') {
    super(message);
  }
}

/**
 * Thrown by `CategoryDomainService.unfollowCategory` when the caller
 * is not currently following the target category.
 *
 * Business rationale (audit issue: silent-success DELETE): the
 * endpoint means "remove an existing follow", not "ensure no follow
 * exists". The previous implementation returned 204 unconditionally,
 * silently logging a `category_unfollowed` event when nothing
 * actually changed. After this class is thrown, the cache write and
 * log line are conditional on the existence check. Mirrors the social
 * module's `FriendshipNotFoundError` / `UserNotBlockedError` /
 * `FollowNotFoundError` pattern.
 */
export class CategoryFollowNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_FOLLOW_NOT_FOUND';
  constructor(message = 'You are not following this category') {
    super(message);
  }
}
