import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthDomainEventPublisherPort } from './oauth-domain-event-publisher.port';
import type {
  OAuthAccountCreatedDomainEvent,
  OAuthAccountLinkedDomainEvent,
  OAuthLoginDomainEvent,
  OAuthLoginFailedDomainEvent,
} from './oauth-domain.events';

@Injectable()
export class OAuthDomainEventPublisher implements OAuthDomainEventPublisherPort {
  constructor(
    @InjectPinoLogger(OAuthDomainEventPublisher.name) private readonly logger: PinoLogger,
  ) {}

  publishOAuthAccountCreated(event: OAuthAccountCreatedDomainEvent): void {
    this.logger.info({
      event: 'oauth_account_created',
      domainEvent: true,
      userId: event.userId,
      provider: event.provider,
      providerUserId: event.providerUserId,
      username: event.username,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthAccountLinked(event: OAuthAccountLinkedDomainEvent): void {
    this.logger.info({
      event: 'oauth_account_linked',
      domainEvent: true,
      userId: event.userId,
      provider: event.provider,
      providerUserId: event.providerUserId,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthLogin(event: OAuthLoginDomainEvent): void {
    this.logger.info({
      event: 'oauth_login',
      domainEvent: true,
      userId: event.userId,
      provider: event.provider,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthLoginFailed(event: OAuthLoginFailedDomainEvent): void {
    this.logger.warn({
      event: 'oauth_login_failed',
      domainEvent: true,
      provider: event.provider,
      reason: event.reason,
      userId: event.userId ?? undefined,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }
}
