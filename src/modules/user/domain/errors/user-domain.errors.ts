import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * User-module namespace marker for user-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, and attempt modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. The user
 * module's repositories do not currently throw a "generic" failure; every
 * throw site uses a specific subclass.
 */
export abstract class UserDomainError extends BaseDomainException {}

/**
 * Thrown when a user cannot be found by id (user-side variant). 404 Not Found.
 *
 * Distinct from `AUTH_USER_NOT_FOUND` (401), which is the auth-flow variant.
 * Both classes are exported separately; they have the same name but
 * different module identities. Clients distinguish via `extensions.code`.
 * Unification deferred per plan §9 item 1.
 */
export class UserNotFoundError extends UserDomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor(message = 'User not found') {
    super(message);
  }
}

export class UserAnalyticsNotFoundError extends UserDomainError {
  readonly code = 'USER_ANALYTICS_NOT_FOUND';
  constructor(message = 'User analytics not found') {
    super(message);
  }
}
