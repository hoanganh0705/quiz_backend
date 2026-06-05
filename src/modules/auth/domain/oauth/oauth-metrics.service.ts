import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthProvider } from './oauth.types';

type OAuthMetricEvent = {
  event:
    | 'oauth_invalid_token'
    | 'oauth_authentication_failed'
    | 'oauth_login'
    | 'oauth_account_created'
    | 'oauth_account_linked'
    | 'oauth_login_failed';
  metric:
    | 'oauth_invalid_token_total'
    | 'oauth_authentication_failed_total'
    | 'oauth_login_total'
    | 'oauth_account_created_total'
    | 'oauth_account_linked_total'
    | 'oauth_login_failed_total';
  provider: OAuthProvider;
  reason?: string;
};

/**
 * Metrics service for OAuth authentication events.
 *
 * All events are emitted as structured logs with a `metric` field so they can be
 * scraped by log-based metric collectors (e.g. Promtail + Prometheus).
 *
 * Recommended Prometheus recording rules / alerts:
 *   oauth_invalid_token_total{provider="google"}  — counter
 *   oauth_authentication_failed_total{provider="google",reason="..."}  — counter
 *   oauth_login_total{provider="google"}  — counter
 *   oauth_account_created_total{provider="google"}  — counter
 *   oauth_account_linked_total{provider="google"}  — counter
 *   oauth_login_failed_total{provider="google"}  — counter
 */
@Injectable()
export class OAuthMetricsService {
  constructor(@InjectPinoLogger(OAuthMetricsService.name) private readonly logger: PinoLogger) {}

  private logMetric(level: 'info' | 'warn', event: OAuthMetricEvent): void {
    this.logger[level]({
      metric: event.metric,
      metricType: 'counter',
      provider: event.provider,
      reason: event.reason,
      increment: 1,
      event: event.event,
    });
  }

  /**
   * Increments the invalid token counter.
   * Called for every `InvalidOAuthTokenError` from any provider adapter.
   */
  recordInvalidToken(provider: OAuthProvider): void {
    this.logMetric('warn', {
      event: 'oauth_invalid_token',
      metric: 'oauth_invalid_token_total',
      provider,
    });
  }

  /**
   * Increments the authentication-failed counter with a reason label.
   */
  recordAuthenticationFailed(provider: OAuthProvider, reason: string): void {
    this.logMetric('warn', {
      event: 'oauth_authentication_failed',
      metric: 'oauth_authentication_failed_total',
      provider,
      reason,
    });
  }

  /**
   * Increments the successful login counter.
   */
  recordLoginSuccess(provider: OAuthProvider): void {
    this.logMetric('info', {
      event: 'oauth_login',
      metric: 'oauth_login_total',
      provider,
    });
  }

  /**
   * Increments the account-created counter.
   */
  recordAccountCreated(provider: OAuthProvider): void {
    this.logMetric('info', {
      event: 'oauth_account_created',
      metric: 'oauth_account_created_total',
      provider,
    });
  }

  /**
   * Increments the account-linked counter.
   */
  recordAccountLinked(provider: OAuthProvider): void {
    this.logMetric('info', {
      event: 'oauth_account_linked',
      metric: 'oauth_account_linked_total',
      provider,
    });
  }

  /**
   * Increments the login-failed (durable) counter.
   * Called for `UserNotFoundError`, `RateLimitExceededError`, `TokenReuseDetectedError`.
   */
  recordLoginFailed(provider: OAuthProvider, reason: string): void {
    this.logMetric('warn', {
      event: 'oauth_login_failed',
      metric: 'oauth_login_failed_total',
      provider,
      reason,
    });
  }
}
