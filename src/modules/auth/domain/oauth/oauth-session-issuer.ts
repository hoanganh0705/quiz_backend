import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { SessionRequestContext } from '../../types/auth-context.types';
import type { LoginResult } from '../../types/auth-result.types';
import type { AuthIdentity } from '../../types/auth-context.types';
import { SessionService } from '../session.service';
import { SecurityService } from '../security.service';
import { TOKEN_PROVIDER, type TokenProvider } from '../ports/token.provider';
import type { OAuthProvider } from './oauth.types';

/**
 * OAuthSessionIssuer
 *
 * Responsible ONLY for:
 * - Rate-limit enforcement for the session phase
 * - Token issuance
 * - Session creation
 *
 * Does NOT handle events — caller (OAuthLoginService) publishes events after this returns.
 */
@Injectable()
export class OAuthSessionIssuer {
  constructor(
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    @Inject(TOKEN_PROVIDER) private readonly tokenService: TokenProvider,
    @InjectPinoLogger(OAuthSessionIssuer.name) private readonly logger: PinoLogger,
  ) {}

  async issue(
    user: { userId: string; username: string; email: string; role: 'admin' | 'moderator' | 'user' },
    context: SessionRequestContext,
    provider: OAuthProvider,
  ): Promise<LoginResult> {
    await this.securityService.enforceLoginRateLimit(context, user.userId);

    const identity: AuthIdentity = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const sessionId = randomUUID();
    const tokens = await this.tokenService.issueTokens(identity, sessionId);

    await this.sessionService.createSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
      sessionId,
    );

    this.logger.info({
      event: 'oauth_session_issued',
      userId: user.userId,
      provider,
      sessionId,
    });

    return {
      userId: identity.userId,
      username: identity.username,
      email: identity.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId,
    };
  }
}
