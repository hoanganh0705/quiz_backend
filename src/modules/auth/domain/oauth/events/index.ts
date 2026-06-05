// Integration event types (durable — written to outbox inside repository/service transactions)
export {
  type OAuthAccountCreatedEvent,
  type OAuthAccountLinkedEvent,
  type OAuthLoginEvent,
  type OAuthLoginFailedEvent,
  type OAuthSecurityEvent,
} from './oauth.events';

// Domain event types (in-process — fire-and-forget via OAuthDomainEventPublisher)
export {
  type OAuthDomainEvent,
  type OAuthAccountCreatedDomainEvent,
  type OAuthAccountLinkedDomainEvent,
  type OAuthLoginDomainEvent,
  type OAuthLoginFailedDomainEvent,
} from './oauth-domain.events';

// Domain event publisher port + implementation
export {
  type OAuthDomainEventPublisherPort,
  OAUTH_DOMAIN_EVENT_PUBLISHER,
} from './oauth-domain-event-publisher.port';
