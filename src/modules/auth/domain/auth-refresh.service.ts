import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  AuthIdentity,
  RefreshTokenPayload,
  SessionRequestContext,
} from '../types/auth-context.types';
import type { RefreshTokenResult } from '../types/auth-result.types';
import { TOKEN_PROVIDER, type TokenProvider } from './ports/token.provider';
import { SessionService } from './session.service';
import { SecurityService } from './security.service';
import { type SessionRecord } from './ports/session-repository.port';
import { CRYPTO_PROVIDER, type CryptoProvider } from './ports/crypto.provider';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from './ports/user-repository.port';
import { SessionContextMismatchError, TokenReuseDetectedError, UserNotFoundError } from './errors';

const REFRESH_TOKEN_REUSE_MESSAGE = 'Refresh token reuse detected. All sessions have been revoked';

@Injectable()
export class AuthRefreshService {
  constructor(
    @Inject(TOKEN_PROVIDER)
    private readonly tokenService: TokenProvider,
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    @Inject(CRYPTO_PROVIDER)
    private readonly cryptoService: CryptoProvider,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(AuthRefreshService.name) private readonly logger: PinoLogger,
  ) {}

  private toAuthIdentity(user: {
    userId: string;
    username: string;
    email: string;
    role: AuthIdentity['role'];
  }): AuthIdentity {
    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  private async revokeAndReject(
    userId: string,
    message = REFRESH_TOKEN_REUSE_MESSAGE,
  ): Promise<never> {
    await this.sessionService.revokeAllActiveSessions(userId);
    throw new TokenReuseDetectedError(message);
  }

  private isSha256HexEqual(left: string, right: string): boolean {
    try {
      const leftBuf = Buffer.from(left, 'hex');
      const rightBuf = Buffer.from(right, 'hex');

      if (leftBuf.length !== rightBuf.length) {
        return false;
      }

      return timingSafeEqual(leftBuf, rightBuf);
    } catch {
      return false;
    }
  }

  private async resolveExistingSession(
    payload: RefreshTokenPayload,
    context: SessionRequestContext,
    nowIso: string,
  ): Promise<SessionRecord> {
    const sessionByJti = await this.sessionService.getSessionByJtiAndUserId(
      payload.jti,
      payload.sub,
      nowIso,
    );

    if (sessionByJti) {
      return sessionByJti;
    }

    const latestSession = await this.sessionService.findLatestActiveSessionByUserId(
      payload.sub,
      nowIso,
    );

    const isGraceReuse =
      latestSession &&
      this.securityService.canUseRefreshReuseGraceWindow(latestSession, context, nowIso);

    if (isGraceReuse) {
      return latestSession;
    }

    this.logger.warn({
      event: 'auth_refresh_invalid_or_missing_session',
      userId: payload.sub,
      jti: payload.jti,
    });

    return this.revokeAndReject(payload.sub);
  }

  private async verifySessionIntegrity(
    session: SessionRecord,
    refreshTokenHash: string,
    payload: RefreshTokenPayload,
    context: SessionRequestContext,
    nowIso: string,
  ): Promise<void> {
    if (this.isSha256HexEqual(session.refreshTokenHash, refreshTokenHash)) {
      return;
    }

    const isGraceReuse = await this.securityService.handleGraceWindowReuse(
      session,
      context,
      nowIso,
      payload,
    );

    if (isGraceReuse) {
      return;
    }

    this.logger.warn({
      event: 'auth_refresh_reuse_detected_hash_mismatch',
      userId: payload.sub,
    });

    return this.revokeAndReject(payload.sub);
  }

  async refreshToken(
    refreshToken: string,
    context: SessionRequestContext,
  ): Promise<RefreshTokenResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    await this.securityService.enforceRefreshRateLimit(context, payload.sub);

    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const nowIso = new Date().toISOString();

    const existingSession = await this.resolveExistingSession(payload, context, nowIso);
    await this.verifySessionIntegrity(existingSession, refreshTokenHash, payload, context, nowIso);

    const bindingResult = this.securityService.evaluateSessionBinding(existingSession, context);
    if (bindingResult.shouldReject) {
      this.logger.warn({
        event: 'auth_refresh_session_binding_rejected',
        userId: payload.sub,
        sessionId: existingSession.sessionId,
        jti: payload.jti,
      });
      throw new SessionContextMismatchError();
    }

    const user = await this.userRepository.findActiveIdentityById(existingSession.userId);
    if (!user) {
      this.logger.warn({ event: 'auth_refresh_user_not_found' });
      throw new UserNotFoundError();
    }

    const identity = this.toAuthIdentity(user);
    const tokens = await this.tokenService.issueTokens(identity);

    await this.sessionService.rotateSession(existingSession.sessionId, tokens, context, nowIso);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.tokenService.tryVerifyRefreshToken(refreshToken);

    if (payload) {
      await this.sessionService.revokeSessionByJti(payload.jti);
      return;
    }

    this.logger.info({ event: 'auth_logout_fallback_to_hash', reason: 'refresh_token_not_jwt' });
    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    await this.sessionService.revokeSessionByRefreshTokenHash(refreshTokenHash);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllActiveSessions(userId);
  }
}
