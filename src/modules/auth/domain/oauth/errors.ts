import { AuthDomainError } from '../errors/auth-domain.errors';

/**
 * Thrown when the provider token (ID token, access token, auth code) fails
 * signature, expiry, audience, or issuer validation.
 * Does NOT produce a durable outbox event — logged/metrics only.
 */
export class InvalidOAuthTokenError extends AuthDomainError {
  constructor(message = 'Invalid or expired OAuth credentials') {
    super(message);
  }
}

/**
 * Thrown when a user attempts to link an OAuth provider that is already
 * linked to another account in the system.
 */
export class OAuthAccountAlreadyExistsError extends AuthDomainError {
  constructor() {
    super('OAuth account link already exists');
  }
}

/**
 * Thrown when an existing (non-OAuth) account is found for the email but
 * is unverified. Requires explicit confirmation before linking.
 */
export class OAuthAccountLinkingRequiredError extends AuthDomainError {
  constructor() {
    super(
      'Account linking requires explicit confirmation because the existing account is not verified.',
    );
  }
}
