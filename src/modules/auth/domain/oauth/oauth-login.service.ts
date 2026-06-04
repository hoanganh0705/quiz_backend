import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { OAuthProviderPort } from './ports/oauth-provider.port';
import { OAUTH_PROVIDER_PORT } from './ports/oauth-provider.port';
import type { OAuthAccountRepositoryPort } from './ports/oauth-account-repository.port';
import { OAUTH_ACCOUNT_REPOSITORY_PORT } from './ports/oauth-account-repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../ports/user-repository.port';
import { OUTBOX_PORT, type OutboxPort } from '../ports/outbox.port';
import type { SessionRequestContext } from '../types/auth-context.types';
import type { LoginResult } from '../types/auth-result.types';
import type { OAuthProvider } from './oauth.types';
import { SessionService } from '../session.service';
import { SecurityService } from '../security.service';
import { TOKEN_PROVIDER, type TokenProvider } from '../ports/token.provider';
import { AuthIdentity } from '../types/auth-context.types';
import {
  InvalidOAuthTokenError,
  OAuthAccountLinkingRequiredError,
  UserNotFoundError,
} from '../errors';

export type OAuthLoginCommand = {
  provider: OAuthProvider;
  idToken?: string;
  code?: string;
  accessToken?: string;
};

@Injectable()
export class OAuthLoginService {
  constructor(
    @Inject(OAUTH_PROVIDER_PORT)
    private readonly oauthProvider: OAuthProviderPort,
    @Inject(OAUTH_ACCOUNT_REPOSITORY_PORT)
    private readonly oauthAccountRepository: OAuthAccountRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenService: TokenProvider,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    @InjectPinoLogger(OAuthLoginService.name) private readonly logger: PinoLogger,
  ) {}

  private toAuthIdentity(user: {
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'moderator' | 'user';
  }): AuthIdentity {
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  async login(command: OAuthLoginCommand, context: SessionRequestContext): Promise<LoginResult> {
    // 1. Enforce rate limit before doing anything expensive
    await this.securityService.enforceLoginRateLimit(context);

    // 2. Authenticate with the provider
    let claims;
    try {
      claims = await this.oauthProvider.authenticate({
        idToken: command.idToken,
        code: command.code,
        accessToken: command.accessToken,
      });
    } catch (error) {
      // InvalidOAuthTokenError → log + metrics only, no outbox event
      if (error instanceof InvalidOAuthTokenError) {
        this.logger.warn({
          event: 'oauth_authentication_failed',
          provider: command.provider,
          reason: error.message,
        });
        // Metrics: oauth_invalid_token_total{provider=...}
      }
      throw error;
    }

    // 3. Check if this OAuth account is already linked
    const existingRecord = await this.oauthAccountRepository.findByProviderAndProviderUserId(
      command.provider,
      claims.providerUserId,
    );

    if (existingRecord) {
      // Known user — load identity and create session
      const user = await this.userRepository.findActiveIdentityById(existingRecord.userId);
      if (!user) {
        this.logger.error({
          event: 'oauth_login_user_missing',
          provider: command.provider,
          userId: existingRecord.userId,
        });
        throw new UserNotFoundError('OAuth user not found');
      }

      return this.createSession(user, context, command.provider);
    }

    // 4. No existing OAuth record — check for an existing user with this email
    const existingUser = await this.userRepository.findActiveIdentityByEmail(claims.email);

    if (existingUser) {
      // Unverified existing user → require explicit confirmation
      if (!existingUser.isVerified) {
        throw new OAuthAccountLinkingRequiredError();
      }

      // Verified existing user → auto-link and log in
      await this.oauthAccountRepository.linkOAuthAccountToExistingUser({
        userId: existingUser.userId,
        provider: command.provider,
        providerUserId: claims.providerUserId,
      });

      return this.createSession(existingUser, context, command.provider);
    }

    // 5. Brand-new user → create account with OAuth link
    const newUser = await this.oauthAccountRepository.createOAuthUserWithLink({
      provider: command.provider,
      providerUserId: claims.providerUserId,
      email: claims.email,
    });

    return this.createSession(newUser, context, command.provider);
  }

  private async createSession(
    user: { userId: string; username: string; email: string; role: 'admin' | 'moderator' | 'user' },
    context: SessionRequestContext,
    provider: OAuthProvider,
  ): Promise<LoginResult> {
    await this.securityService.enforceLoginRateLimit(context, user.userId);

    const identity = this.toAuthIdentity(user);
    const sessionId = randomUUID();
    const tokens = await this.tokenService.issueTokens(identity, sessionId);

    await this.sessionService.createSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
      sessionId,
    );

    // Schedule oauth_login event AFTER session commit — eventually consistent only.
    // Catch is already handled inside scheduleOAuthLoginEvent.
    void this.scheduleOAuthLoginEvent(user.userId, provider);

    return {
      userId: identity.userId,
      username: identity.username,
      email: identity.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId,
    };
  }

  private async scheduleOAuthLoginEvent(userId: string, provider: OAuthProvider): Promise<void> {
    try {
      await this.outbox.scheduleEvent({
        aggregateType: 'oauth_login',
        eventType: 'oauth_login',
        payload: { userId, provider },
        nowIso: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error({
        event: 'oauth_login_event_write_failed',
        provider,
        userId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
