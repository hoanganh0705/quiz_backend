import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthProviderRegistry } from './ports/oauth-provider-registry.port';
import { OAUTH_PROVIDER_REGISTRY } from './ports/oauth-provider-registry.port';
import type { OAuthAuthenticationPayload, OAuthUserInfo } from './ports/oauth-provider.port';
import type { OAuthProvider } from './oauth.types';
import { InvalidOAuthTokenError } from './errors';
import { OAuthMetricsService } from './oauth-metrics.service';
import { SecurityService } from '../security.service';
import type { SessionRequestContext } from '../../types/auth-context.types';

/**
 * OAuthIdentityResolver
 *
 * Responsible ONLY for:
 * - Resolving the correct provider adapter from the registry
 * - Authenticating the provider credential
 * - Enforcing email verification requirement
 * - Rate-limit enforcement
 *
 * This is the first gate in the OAuth login flow. Any failure here throws
 * before any database access occurs.
 */
@Injectable()
export class OAuthIdentityResolver {
  constructor(
    @Inject(OAUTH_PROVIDER_REGISTRY)
    private readonly registry: OAuthProviderRegistry,
    private readonly securityService: SecurityService,
    private readonly metrics: OAuthMetricsService,
    @InjectPinoLogger(OAuthIdentityResolver.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Resolves the provider adapter, authenticates the credential, and enforces
   * that the email is verified before returning claims.
   *
   * @throws {InvalidOAuthTokenError} for invalid tokens, wrong provider, or unverified email
   */
  async resolve(
    provider: OAuthProvider,
    authentication: OAuthAuthenticationPayload,
  ): Promise<OAuthUserInfo> {
    const adapter = this.registry.get(provider);

    let claims: OAuthUserInfo;
    try {
      claims = await adapter.authenticate(authentication);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error instanceof InvalidOAuthTokenError) {
        this.logger.warn({
          event: 'oauth_authentication_failed',
          provider,
          reason: error.message,
        });
        this.metrics.recordInvalidToken(provider);
        this.metrics.recordAuthenticationFailed(provider, error.message);
      }
      throw error;
    }

    // Enforce email verification — security gate
    if (!claims.emailVerified) {
      this.logger.warn({
        event: 'oauth_unverified_email_rejected',
        provider,
        email: claims.email,
      });
      this.metrics.recordAuthenticationFailed(provider, 'unverified_email');
      throw new InvalidOAuthTokenError('OAuth email is not verified');
    }

    return claims;
  }

  async enforceRateLimit(context: SessionRequestContext, userId?: string): Promise<void> {
    return this.securityService.enforceLoginRateLimit(context, userId);
  }
}
