import { AuthDomainError } from '../errors/auth-domain.errors';

/**
 * Thrown when the provider token (ID token, access token, auth code) fails
 * signature, expiry, audience, or issuer validation.
 * Does NOT produce a durable outbox event — logged/metrics only.
 *
 * 401 Unauthorized.
 */
export class InvalidOAuthTokenError extends AuthDomainError {
  readonly code = 'AUTH_OAUTH_INVALID_TOKEN';
  constructor(message = 'Invalid or expired OAuth credentials') {
    super(message);
  }
}

/**
 * Thrown when a user attempts to link an OAuth provider that is already
 * linked to another account in the system.
 *
 * 409 Conflict.
 *
 * NOTE: exported but never thrown in the current codebase. The previous
 * `AuthDomainExceptionFilter` had no `instanceof OAuthAccountAlreadyExistsError`
 * branch so it silently fell through to a 500 — the new mapping corrects
 * that bug as a side effect. If it remains dead after the migration,
 * delete in a follow-up cleanup PR.
 */
export class OAuthAccountAlreadyExistsError extends AuthDomainError {
  readonly code = 'AUTH_OAUTH_ACCOUNT_ALREADY_EXISTS';
  constructor() {
    super('OAuth account link already exists');
  }
}

/**
 * Thrown when an existing (non-OAuth) account is found for the email but
 * is unverified. Requires explicit confirmation before linking.
 *
 * 409 Conflict.
 */
export class OAuthAccountLinkingRequiredError extends AuthDomainError {
  readonly code = 'AUTH_OAUTH_LINKING_REQUIRED';
  constructor() {
    super(
      'Account linking requires explicit confirmation because the existing account is not verified.',
    );
  }
}