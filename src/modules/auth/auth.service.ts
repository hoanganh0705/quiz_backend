import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
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
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
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
    if (session.refreshTokenHash === refreshTokenHash) {
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
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return this.revokeAndReject(
      payload.sub,
      'Refresh token reuse detected. All sessions have been revoked',
    );
  }

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const normalizedUsername = registerDto.username.trim().toLowerCase();

    try {
      await this.userRepository.ensureEmailAndUsernameAvailable(
        normalizedEmail,
        normalizedUsername,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn({ event: 'auth_register_conflict', email: normalizedEmail });
      }
      throw error;
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const createdUser = await this.userRepository.createUser(
      normalizedEmail,
      normalizedUsername,
      passwordHash,
    );

    await this.issueAndSendVerificationToken(createdUser.userId, createdUser.email);

    return {
      userId: createdUser.userId,
      username: createdUser.username,
      email: createdUser.email,
      createdAt: createdUser.createdAt,
      message: 'Registration successful. Please verify your email before logging in.',
    };
  }

  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    const tokenHash = this.cryptoService.hashSha256(token);
    const nowIso = new Date().toISOString();

    const user: { userId: string; email: string } | null =
      await this.userRepository.findUserByActiveVerificationToken(tokenHash, nowIso);
    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired token. Please request a new verification email.',
      );
    }

    await this.userRepository.markEmailAsVerified(user.userId, nowIso);

    this.logger.info({
      event: 'auth_email_verified',
      userId: user.userId,
      email: user.email,
    });

    return {
      message: 'Email verified successfully. Please log in to continue.',
    };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const foundUser: { userId: string; email: string; isVerified: boolean } | null =
      await this.userRepository.findActiveVerificationStatusByEmail(normalizedEmail);

    // Do not reveal account existence/verification state.
    if (!foundUser || foundUser.isVerified) {
      return {
        message: 'If this email exists and is not verified, a verification email has been sent.',
      };
    }

    await this.issueAndSendVerificationToken(foundUser.userId, foundUser.email);

    return {
      message: 'If this email exists and is not verified, a verification email has been sent.',
    };
  }

  async login(loginDto: LoginDto, context: SessionRequestContext): Promise<LoginResult> {
    await this.securityService.enforceLoginRateLimit(context);

    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const foundUser = await this.userRepository.findActiveByEmailWithPassword(normalizedEmail);

    if (!foundUser) {
      this.logger.warn({ event: 'auth_login_user_not_found', email: normalizedEmail });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!foundUser.isVerified) {
      this.logger.warn({ event: 'auth_login_email_not_verified', userId: foundUser.userId });
      throw new UnauthorizedException('Email is not verified');
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
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
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
