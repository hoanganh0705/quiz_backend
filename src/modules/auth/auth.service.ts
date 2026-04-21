import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes, timingSafeEqual } from 'crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CryptoService } from '@/common/service/crypto.service';
import { LoginDto } from './dto/request/login.dto';
import { RegisterDto } from './dto/request/register.dto';
import {
  AuthIdentity,
  LoginResult,
  RefreshTokenResult,
  RefreshTokenPayload,
  RegisterResult,
  SessionRequestContext,
  VerifyEmailResult,
} from './types/auth.types';
import { UserRepository } from '@/core/database/repositories/user.repository';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { SecurityService } from './services/security.service';
import { type SessionRecord } from '@/core/database/repositories/user-session.repository';
import { AuthConfig } from './auth.config';
import { EmailService } from '@/modules/email/email.service';

@Injectable()
export class AuthService {
  private static readonly RESEND_VERIFICATION_GENERIC_MESSAGE =
    'If this email exists and is not verified, a verification email has been sent.';
  private static readonly REGISTER_GENERIC_MESSAGE =
    'If your registration can be completed, a verification email will be sent.';
  private static readonly DUMMY_PASSWORD_HASH =
    '$2b$12$4HFj7c4f1QH7wHTQXhH1ueYCMr5xM9A2m8K6q9M2m6I6QfZlq6QmW';

  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    private readonly cryptoService: CryptoService,
    private readonly authConfig: AuthConfig,
    private readonly emailService: EmailService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  private generateVerificationToken(): string {
    // 32 random bytes => 64-char hex token.
    return randomBytes(32).toString('hex');
  }

  private getVerificationExpiryIso(): string {
    return new Date(
      Date.now() + this.authConfig.emailVerificationTokenTtlSeconds * 1_000,
    ).toISOString();
  }

  private async issueAndSendVerificationToken(userId: string, email: string): Promise<void> {
    const rawToken = this.generateVerificationToken();
    const tokenHash = this.cryptoService.hashSha256(rawToken);
    const expiresAtIso = this.getVerificationExpiryIso();

    // Write token state first, then enqueue email.
    // If enqueue fails, no email is sent and user can recover via resend endpoint.
    // This avoids ever sending an email link whose token is not persisted.
    await this.userRepository.setEmailVerificationToken(userId, tokenHash, expiresAtIso);
    await this.emailService.enqueueVerificationEmail(email, rawToken, userId);
  }

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

  private async revokeAndReject(userId: string, message: string): Promise<never> {
    await this.sessionService.revokeAllActiveSessions(userId);
    throw new UnauthorizedException(message);
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

  /**
   * Resolves the session that should be used for the refresh.
   *
   * Primary path: look up by JTI + userId. If found, return it immediately.
   *
   * Fallback path: the JTI lookup misses (e.g. after a race between two
   * concurrent refresh calls). We find the user's latest active session and
   * check whether the request falls within the grace window. If it does, we
   * treat that session as the target and return it. Otherwise we assume token
   * reuse and revoke everything.
   */
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
      (await this.securityService.handleGraceWindowReuse(latestSession, context, nowIso, payload));

    if (isGraceReuse) {
      return latestSession;
    }

    this.logger.warn({
      event: 'auth_refresh_invalid_or_missing_session',
      userId: payload.sub,
      jti: payload.jti,
    });

    return this.revokeAndReject(
      payload.sub,
      'Refresh token reuse detected. All sessions have been revoked',
    );
  }

  /**
   * Verifies that the incoming refresh token actually belongs to the resolved
   * session by comparing hashes.
   *
   * A mismatch means either a stale token (race condition) or an adversary
   * replaying an old token. The grace window handles the former; anything
   * outside it is treated as the latter and triggers a full revocation.
   */
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
      sessionId: session.sessionId,
      jti: payload.jti,
    });

    return this.revokeAndReject(
      payload.sub,
      'Refresh token reuse detected. All sessions have been revoked',
    );
  }

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const normalizedUsername = registerDto.username.trim().toLowerCase();

    const existingUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    if (existingUser) {
      if (!existingUser.isVerified) {
        try {
          await this.issueAndSendVerificationToken(existingUser.userId, existingUser.email);
        } catch (error) {
          this.logger.error({
            event: 'auth_register_existing_unverified_enqueue_failed',
            userId: existingUser.userId,
            message: error instanceof Error ? error.message : 'Unknown enqueue error',
          });
        }
      }

      return {
        message: AuthService.REGISTER_GENERIC_MESSAGE,
      };
    }

    try {
      await this.userRepository.ensureEmailAndUsernameAvailable(
        normalizedEmail,
        normalizedUsername,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn({ event: 'auth_register_conflict' });
        return {
          message: AuthService.REGISTER_GENERIC_MESSAGE,
        };
      }
      throw error;
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const createdUser = await this.userRepository.createUser(
      normalizedEmail,
      normalizedUsername,
      passwordHash,
    );

    try {
      await this.issueAndSendVerificationToken(createdUser.userId, createdUser.email);
    } catch (error) {
      this.logger.error({
        event: 'auth_register_verification_enqueue_failed',
        userId: createdUser.userId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });
    }

    return {
      message: AuthService.REGISTER_GENERIC_MESSAGE,
    };
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const tokenHash = this.cryptoService.hashSha256(token);
    const nowIso = new Date().toISOString();

    const user: { userId: string; email: string } | null =
      await this.userRepository.findUserByActiveVerificationToken(tokenHash, nowIso);
    if (user) {
      await this.userRepository.markEmailAsVerified(user.userId, nowIso);

      this.logger.info({
        event: 'auth_email_verified',
        userId: user.userId,
      });
    }

    return {
      message: 'Verification processed. If valid, your email is now verified.',
    };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const foundUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    // Do not reveal account existence/verification state.
    if (!foundUser || foundUser.isVerified) {
      return {
        message: AuthService.RESEND_VERIFICATION_GENERIC_MESSAGE,
      };
    }

    try {
      await this.issueAndSendVerificationToken(foundUser.userId, foundUser.email);
    } catch (error) {
      this.logger.error({
        event: 'auth_resend_verification_email_enqueue_failed',
        userId: foundUser.userId,
        message: error instanceof Error ? error.message : 'Unknown enqueue error',
      });
    }

    return {
      message: AuthService.RESEND_VERIFICATION_GENERIC_MESSAGE,
    };
  }

  async login(loginDto: LoginDto, context: SessionRequestContext): Promise<LoginResult> {
    await this.securityService.enforceLoginRateLimit(context);

    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const foundUser = await this.userRepository.findActiveByEmailWithPassword(normalizedEmail);

    if (!foundUser) {
      // Keep similar compute cost across failure paths to reduce timing-based account probing.
      await bcrypt.compare(loginDto.password, AuthService.DUMMY_PASSWORD_HASH);
      this.logger.warn({ event: 'auth_login_failed' });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!foundUser.isVerified) {
      // Keep similar compute cost across failure paths to reduce timing-based account probing.
      await bcrypt.compare(loginDto.password, AuthService.DUMMY_PASSWORD_HASH);
      this.logger.warn({ event: 'auth_login_failed', userId: foundUser.userId });
      // Fire-and-forget so login timing is not coupled to Redis/queue/provider latency.
      void this.securityService
        .tryAcquireLoginUnverifiedVerificationEmailSlot(foundUser.userId)
        .then((canEnqueue) => {
          if (!canEnqueue) return;
          return this.issueAndSendVerificationToken(foundUser.userId, foundUser.email);
        })
        .catch((error) => {
          this.logger.error({
            event: 'auth_login_unverified_enqueue_failed',
            userId: foundUser.userId,
            message: error instanceof Error ? error.message : 'Unknown enqueue error',
          });
        });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.securityService.enforceLoginRateLimit(context, foundUser.userId);

    const isPasswordValid = await bcrypt.compare(loginDto.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({ event: 'auth_login_invalid_password', userId: foundUser.userId });
      throw new UnauthorizedException('Invalid email or password');
    }

    const identity = this.toAuthIdentity(foundUser);
    const tokens = await this.tokenService.issueTokens(identity);
    const { accessToken, refreshToken } = tokens;

    await this.sessionService.createSession(
      identity.userId,
      refreshToken,
      tokens.refreshTokenJti,
      context,
    );

    return {
      userId: identity.userId,
      username: identity.username,
      email: identity.email,
      accessToken,
      refreshToken,
    };
  }

  /*
  Flow for refresh token handling:
    verifyRefreshToken → enforceRateLimit → resolveExistingSession
    → verifySessionIntegrity → evaluateSessionBinding → issueTokens → rotateSession 
  */
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
      throw new UnauthorizedException('Session context mismatch');
    }

    const user = await this.userRepository.findActiveIdentityById(existingSession.userId);
    if (!user) {
      this.logger.warn({ event: 'auth_refresh_user_not_found', userId: existingSession.userId });
      throw new UnauthorizedException('User not found');
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

    this.logger.warn({ event: 'auth_logout_fallback_to_hash' });
    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    await this.sessionService.revokeSessionByRefreshTokenHash(refreshTokenHash);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllActiveSessions(userId);
  }
}
