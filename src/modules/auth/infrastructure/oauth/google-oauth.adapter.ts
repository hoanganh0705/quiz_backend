import { Injectable } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type OAuthAuthenticationPayload,
  type OAuthProviderPort,
  type OAuthUserInfo,
} from '../../domain/oauth/ports/oauth-provider.port';
import { GoogleOAuthConfig } from '../../config/google-oauth.config';
import { InvalidOAuthTokenError } from '../../domain/oauth/errors';

export const GOOGLE_OAUTH_ADAPTER = Symbol('GOOGLE_OAUTH_ADAPTER');

@Injectable()
export class GoogleOAuthAdapter implements OAuthProviderPort {
  readonly provider = 'google' as const;

  private readonly client: OAuth2Client;

  constructor(
    private readonly googleConfig: GoogleOAuthConfig,
    @InjectPinoLogger(GoogleOAuthAdapter.name) private readonly logger: PinoLogger,
  ) {
    this.client = new OAuth2Client(googleConfig.clientId);
  }

  async authenticate(payload: OAuthAuthenticationPayload): Promise<OAuthUserInfo> {
    if (!payload.idToken) {
      this.logger.warn({
        event: 'oauth_invalid_token',
        provider: this.provider,
        reason: 'missing_id_token',
      });
      throw new InvalidOAuthTokenError('Google authentication requires an idToken');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: payload.idToken,
        audience: this.googleConfig.clientId,
      });

      const payload_ = ticket.getPayload();
      if (!payload_) {
        this.logger.warn({
          event: 'oauth_invalid_token',
          provider: this.provider,
          reason: 'null_payload',
        });
        throw new InvalidOAuthTokenError('Google token payload is null');
      }

      const hostedDomain = this.googleConfig.hostedDomain;
      if (hostedDomain && payload_.hd !== hostedDomain) {
        this.logger.warn({
          event: 'oauth_invalid_token',
          provider: this.provider,
          reason: 'wrong_hosted_domain',
          expectedDomain: hostedDomain,
          actualDomain: payload_.hd ?? null,
        });
        throw new InvalidOAuthTokenError(`Must use a ${hostedDomain} Google account`);
      }

      return this.normalizePayload(payload_);
    } catch (error) {
      if (error instanceof InvalidOAuthTokenError) {
        throw error;
      }
      this.logger.warn({
        event: 'oauth_invalid_token',
        provider: this.provider,
        reason: error instanceof Error ? error.message : 'unknown_verification_error',
      });
      throw new InvalidOAuthTokenError('Google token validation failed');
    }
  }

  private normalizePayload(payload: TokenPayload): OAuthUserInfo {
    return {
      providerUserId: payload.sub,
      email: payload.email!.toLowerCase(),
      emailVerified: payload.email_verified ?? false,
      displayName: payload.name ?? undefined,
      avatarUrl: payload.picture ?? undefined,
    };
  }
}
