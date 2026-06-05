import type {
  OAuthAccountCreatedDomainEvent,
  OAuthAccountLinkedDomainEvent,
  OAuthLoginDomainEvent,
  OAuthLoginFailedDomainEvent,
} from './oauth-domain.events';

/**
 * Port for publishing OAuth Domain Events (in-process, fire-and-forget).
 *
 * Architecture:
 *   Domain Events  → OAuthSecurityEventPublisher  → in-process handlers (email, SIEM, analytics)
 *   Integration Events → Outbox                 → durable, eventually-consistent consumers
 *
 * The OAuthLoginService never calls the outbox directly for domain events.
 * Integration events (oauth_account_created, oauth_account_linked, oauth_login)
 * are written to the outbox by the OAuthAccountRepository (inside tx) and
 * OAuthLoginService.scheduleOAuthLoginEvent (after commit) respectively.
 *
 * Implementations are synchronous fire-and-forget. Failures are logged but
 * never propagate — domain events must never break the auth flow.
 */
export interface OAuthDomainEventPublisherPort {
  publishOAuthAccountCreated(event: OAuthAccountCreatedDomainEvent): void;
  publishOAuthAccountLinked(event: OAuthAccountLinkedDomainEvent): void;
  publishOAuthLogin(event: OAuthLoginDomainEvent): void;
  publishOAuthLoginFailed(event: OAuthLoginFailedDomainEvent): void;
}

export const OAUTH_DOMAIN_EVENT_PUBLISHER = Symbol('OAUTH_DOMAIN_EVENT_PUBLISHER');
