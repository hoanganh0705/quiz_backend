/**
 * Domain Events (in-process, fire-and-forget).
 *
 * These are raised synchronously within the request cycle. Downstream handlers
 * (email, SIEM, analytics) receive them immediately. Failures are logged but
 * never propagate — they must never break the auth flow.
 *
 * These correspond to the "Domain Events" column in the event architecture:
 *   - oauth_account_created  → domain event (in-process)
 *   - oauth_account_linked   → domain event (in-process)
 *   - oauth_login           → domain event (in-process)
 *   - oauth_login_failed    → domain event (in-process)
 */
export interface OAuthDomainEvent {
  readonly eventType: string;
  readonly timestamp: Date;
}

export interface OAuthAccountCreatedDomainEvent extends OAuthDomainEvent {
  readonly eventType: 'oauth_account_created';
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly username: string;
}

export interface OAuthAccountLinkedDomainEvent extends OAuthDomainEvent {
  readonly eventType: 'oauth_account_linked';
  readonly userId: string;
  readonly provider: string;
  readonly providerUserId: string;
}

/**
 * Login domain event. Emitted after session creation commits.
 */
export interface OAuthLoginDomainEvent extends OAuthDomainEvent {
  readonly eventType: 'oauth_login';
  readonly userId: string;
  readonly provider: string;
}

/**
 * Login failure domain event. Emitted for durable failures (rate limit, user not found).
 * NOT emitted for InvalidOAuthTokenError (would flood on token spam).
 */
export interface OAuthLoginFailedDomainEvent extends OAuthDomainEvent {
  readonly eventType: 'oauth_login_failed';
  readonly provider: string;
  readonly reason: string;
  readonly userId?: string;
}
