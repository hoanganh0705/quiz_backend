import type {
  OAuthAccountCreatedEvent,
  OAuthAccountLinkedEvent,
  OAuthLoginEvent,
  OAuthLoginFailedEvent,
} from './oauth.events';

/**
 * Port for publishing OAuth domain events to downstream consumers
 * (email, SIEM, analytics, etc.).
 *
 * Implementations are synchronous fire-and-forget; failures are logged
 * but never propagate — events must never break the auth flow.
 */
export interface OAuthSecurityEventPublisherPort {
  publishOAuthAccountCreated(event: OAuthAccountCreatedEvent): void;
  publishOAuthAccountLinked(event: OAuthAccountLinkedEvent): void;
  publishOAuthLogin(event: OAuthLoginEvent): void;
  publishOAuthLoginFailed(event: OAuthLoginFailedEvent): void;
}

export const OAUTH_SECURITY_EVENT_BUS = Symbol('OAUTH_SECURITY_EVENT_BUS');
