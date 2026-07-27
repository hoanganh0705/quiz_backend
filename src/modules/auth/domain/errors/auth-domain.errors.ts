import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Auth-module namespace marker for all auth-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth module's existing
 * structure.)
 */
export abstract class AuthDomainError extends BaseDomainException {}

/**
 * Thrown when a login attempt fails (wrong email, wrong password, or
 * account not found). Surfaces as 401 Unauthorized.
 *
 * Replaces the prior `AuthDomainError extends Error` chain. The
 * `code` is the only domain-side information; HTTP metadata lives in
 * `ProblemCodeMapping` (see plan §6.4).
 */
export class InvalidCredentialsError extends AuthDomainError {
  readonly code = 'AUTH_INVALID_CREDENTIALS';
  constructor(message = 'Invalid email or password') {
    super(message);
  }
}

/**
 * Thrown when a refresh token cannot be validated. 401 Unauthorized.
 */
export class InvalidRefreshTokenError extends AuthDomainError {
  readonly code = 'AUTH_INVALID_REFRESH_TOKEN';
  constructor(message = 'Invalid or expired refresh token') {
    super(message);
  }
}

/**
 * Thrown when token reuse is detected (refresh-token family invalidation).
 * 401 Unauthorized.
 */
export class TokenReuseDetectedError extends AuthDomainError {
  readonly code = 'AUTH_TOKEN_REUSED';
  constructor(message = 'Security action taken on your account. Please log in again.') {
    super(message);
  }
}

/**
 * Thrown when the refresh token's session context does not match the
 * request context (e.g. user-agent fingerprint mismatch). 401 Unauthorized.
 */
export class SessionContextMismatchError extends AuthDomainError {
  readonly code = 'AUTH_SESSION_CONTEXT_MISMATCH';
  constructor(message = 'Session context mismatch') {
    super(message);
  }
}

/**
 * Thrown when an auth-only lookup cannot find the user. 401 Unauthorized.
 *
 * NOTE: This is the AUTH module's user-not-found. The user module has its
 * own `UserNotFoundError` with `code = 'USER_NOT_FOUND'` (409) — they are
 * distinct: the auth variant is a credential-failure signal, the user
 * variant is a profile-resource lookup. The §9 migration plan notes that
 * these should eventually be unified via the user module's exception; that
 * unification is deferred to a separate cross-module PR (see plan §9
 * item 1).
 */
export class UserNotFoundError extends AuthDomainError {
  readonly code = 'AUTH_USER_NOT_FOUND';
  constructor(message = 'User not found') {
    super(message);
  }
}

/**
 * Thrown when an auth-flow-specific rate limit is hit (login throttle,
 * OAuth callback throttle). 429 Too Many Requests.
 *
 * Distinct from `@nestjs/throttler` throttling which produces a native
 * `ThrottlerException` and is mapped by the global filter's status-based
 * path.
 */
export class RateLimitExceededError extends AuthDomainError {
  readonly code = 'AUTH_RATE_LIMITED';
  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
  }
}

/**
 * Generic auth-domain conflict signal. 409 Conflict.
 *
 * NOTE: This exception is exported but never thrown anywhere in the
 * current codebase. It is preserved with a sensible 409 mapping because
 * (a) it has a clear semantic name, (b) the previous `AuthDomainErrorFilter`
 * had no `instanceof ResourceConflictError` branch so it silently fell
 * through to a 500 — the new mapping corrects that bug as a side effect.
 * If the export remains dead after the migration completes, delete it
 * in a follow-up cleanup PR.
 */
export class ResourceConflictError extends AuthDomainError {
  readonly code = 'AUTH_RESOURCE_CONFLICT';
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

/**
 * Thrown when a session cannot be found by id (e.g. logout of an
 * already-revoked session). 404 Not Found.
 */
export class SessionNotFoundError extends AuthDomainError {
  readonly code = 'AUTH_SESSION_NOT_FOUND';
  constructor(message = 'Session not found') {
    super(message);
  }
}

/**
 * Thrown when an email-verification or password-reset token cannot be
 * validated. 400 Bad Request.
 */
export class InvalidTokenError extends AuthDomainError {
  readonly code = 'AUTH_INVALID_TOKEN';
  constructor(message = 'Invalid or expired token') {
    super(message);
  }
}

/**
 * Thrown when a change-password request supplies a wrong current password.
 * 401 Unauthorized.
 */
export class InvalidPasswordError extends AuthDomainError {
  readonly code = 'AUTH_INVALID_CURRENT_PASSWORD';
  constructor(message = 'Invalid current password') {
    super(message);
  }
}

/**
 * Thrown when account deletion fails for non-not-found reasons (already
 * deleted in another transaction, etc.). 409 Conflict.
 */
export class DeletionFailedError extends AuthDomainError {
  readonly code = 'AUTH_DELETION_FAILED';
  constructor(message = 'Account deletion failed') {
    super(message);
  }
}

/**
 * Thrown when the new password matches one of the user's recently-used
 * passwords. 409 Conflict.
 */
export class PasswordReuseError extends AuthDomainError {
  readonly code = 'AUTH_PASSWORD_REUSE';
  constructor(message = 'Password has been used recently. Please choose a different password.') {
    super(message);
  }
}
