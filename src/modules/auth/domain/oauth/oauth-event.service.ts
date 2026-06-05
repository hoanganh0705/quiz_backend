import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthProvider } from './oauth.types';
import type { OutboxPort } from '../ports';
import { OUTBOX_PORT } from '../ports';
import { OAuthDomainEventPublisher } from './events/oauth-domain-event-publisher';

/**
 * OAuthEventService
 *
 * Responsible ONLY for:
 * - Publishing domain events (in-process, fire-and-forget)
 * - Scheduling integration events to the outbox (eventually consistent)
 * - Recording metrics
 *
 * This service is the single entry point for all OAuth event emission,
 * keeping the orchestrator (OAuthLoginService) free of event-logic.
 */
@Injectable()
export class OAuthEventService {
  constructor(
    private readonly domainPublisher: OAuthDomainEventPublisher,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @InjectPinoLogger(OAuthEventService.name) private readonly logger: PinoLogger,
  ) {}

  publishAccountCreated(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
    username: string;
  }): void {
    this.domainPublisher.publishOAuthAccountCreated({
      eventType: 'oauth_account_created',
      ...params,
      timestamp: new Date(),
    });
  }

  publishAccountLinked(params: {
    userId: string;
    provider: OAuthProvider;
    providerUserId: string;
  }): void {
    this.domainPublisher.publishOAuthAccountLinked({
      eventType: 'oauth_account_linked',
      ...params,
      timestamp: new Date(),
    });
  }

  publishLoginSuccess(params: { userId: string; provider: OAuthProvider }): void {
    this.domainPublisher.publishOAuthLogin({
      eventType: 'oauth_login',
      ...params,
      timestamp: new Date(),
    });
  }

  // ── Integration events (outbox — eventually consistent) ────────────────────

  /**
   * Schedules the oauth_login integration event AFTER session commit.
   * Failure to write does NOT roll back the session.
   */
  async scheduleLoginIntegrationEvent(userId: string, provider: OAuthProvider): Promise<void> {
    try {
      await this.outbox.scheduleEvent({
        aggregateType: 'oauth_login',
        eventType: 'oauth_login',
        payload: { userId, provider },
        nowIso: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error({
        event: 'oauth_login_integration_event_write_failed',
        userId,
        provider,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  /**
   * Emits the oauth_login_failed integration event for durable failures
   * (rate limit, user not found, token reuse).
   *
   * Does NOT emit for InvalidOAuthTokenError — that would flood the outbox
   * with token-spam events.
   */
  async emitLoginFailed(params: {
    provider: OAuthProvider;
    reason: string;
    userId?: string;
  }): Promise<void> {
    this.domainPublisher.publishOAuthLoginFailed({
      eventType: 'oauth_login_failed',
      ...params,
      timestamp: new Date(),
    });

    try {
      await this.outbox.scheduleEvent({
        aggregateType: 'oauth_login',
        eventType: 'oauth_login_failed',
        payload: params,
        nowIso: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error({
        event: 'oauth_login_failed_integration_event_write_failed',
        provider: params.provider,
        reason: params.reason,
        err: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
