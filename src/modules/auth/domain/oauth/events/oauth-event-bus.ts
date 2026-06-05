import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthSecurityEventPublisherPort } from './oauth-event-bus.port';
import type {
  OAuthAccountCreatedEvent,
  OAuthAccountLinkedEvent,
  OAuthLoginEvent,
  OAuthLoginFailedEvent,
} from './oauth.events';

@Injectable()
export class OAuthSecurityEventPublisher implements OAuthSecurityEventPublisherPort {
  constructor(
    @InjectPinoLogger(OAuthSecurityEventPublisher.name) private readonly logger: PinoLogger,
  ) {}

  publishOAuthAccountCreated(event: OAuthAccountCreatedEvent): void {
    this.logger.info({
      event: 'oauth_account_created',
      userId: event.userId,
      provider: event.provider,
      providerUserId: event.providerUserId,
      username: event.username,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthAccountLinked(event: OAuthAccountLinkedEvent): void {
    this.logger.info({
      event: 'oauth_account_linked',
      userId: event.userId,
      provider: event.provider,
      providerUserId: event.providerUserId,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthLogin(event: OAuthLoginEvent): void {
    this.logger.info({
      event: 'oauth_login',
      userId: event.userId,
      provider: event.provider,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }

  publishOAuthLoginFailed(event: OAuthLoginFailedEvent): void {
    this.logger.warn({
      event: 'oauth_login_failed',
      provider: event.provider,
      reason: event.reason,
      userId: event.userId ?? undefined,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    });
  }
}
