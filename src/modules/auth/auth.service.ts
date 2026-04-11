import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CryptoService } from '../../common/service/crypto.service';
import { LoginDto } from './dto/request/login.dto';
import { RegisterDto } from './dto/request/register.dto';
import {
  AuthIdentity,
  LoginResult,
  RefreshTokenResult,
  RegisterResult,
  SessionRequestContext,
} from './types/auth.types';
import { UserRepository } from './repositories/user.repository';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { SecurityService } from './services/security.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
    private readonly cryptoService: CryptoService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
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

  async register(
    registerDto: RegisterDto,
    context: SessionRequestContext,
  ): Promise<RegisterResult> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const normalizedUsername = registerDto.username.trim().toLowerCase();

    try {
      await this.userRepository.ensureEmailAndUsernameAvailable(
        normalizedEmail,
        normalizedUsername,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn({
          event: 'auth_register_conflict',
          email: normalizedEmail,
        });
      }

      throw error;
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const createdUser = await this.userRepository.createUser(
      normalizedEmail,
      normalizedUsername,
      passwordHash,
    );

    const identity = this.toAuthIdentity(createdUser);
    const tokens = await this.tokenService.issueTokens(identity);

    await this.sessionService.createSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
    );

    return {
      ...createdUser,
      ...tokens,
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

    await this.securityService.enforceLoginRateLimit(context, foundUser.userId);

    const isPasswordValid = await bcrypt.compare(loginDto.password, foundUser.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({ event: 'auth_login_invalid_password', userId: foundUser.userId });
      throw new UnauthorizedException('Invalid email or password');
    }

    const identity = this.toAuthIdentity(foundUser);
    const tokens = await this.tokenService.issueTokens(identity);

    await this.sessionService.createSession(
      identity.userId,
      tokens.refreshToken,
      tokens.refreshTokenJti,
      context,
    );

    return {
      ...identity,
      ...tokens,
    };
  }

  async refreshToken(
    refreshToken: string,
    context: SessionRequestContext,
  ): Promise<RefreshTokenResult> {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    await this.securityService.enforceRefreshRateLimit(context, payload.sub);

    const refreshTokenHash = this.cryptoService.hashSha256(refreshToken);
    const nowIso = new Date().toISOString();
    let hasHandledGraceReuse = false;

    let existingSession = await this.sessionService.getSessionByJtiAndUserId(
      payload.jti,
      payload.sub,
    );

    if (!existingSession) {
      const latestSession = await this.sessionService.findLatestActiveSessionByUserId(
        payload.sub,
        nowIso,
      );

      if (
        latestSession &&
        (await this.securityService.handleGraceWindowReuse(latestSession, context, nowIso, payload))
      ) {
        existingSession = latestSession;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_session_missing',
          userId: payload.sub,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.sessionService.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    if (existingSession.refreshTokenHash !== refreshTokenHash) {
      if (
        await this.securityService.handleGraceWindowReuse(existingSession, context, nowIso, payload)
      ) {
        hasHandledGraceReuse = true;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_hash_mismatch',
          userId: payload.sub,
          sessionId: existingSession.sessionId,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.sessionService.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    if (
      !hasHandledGraceReuse &&
      (existingSession.revokedAt !== null || existingSession.expiresAt <= nowIso)
    ) {
      if (
        await this.securityService.handleGraceWindowReuse(existingSession, context, nowIso, payload)
      ) {
        hasHandledGraceReuse = true;
      } else {
        this.logger.warn({
          event: 'auth_refresh_reuse_detected_invalid_session_state',
          userId: payload.sub,
          sessionId: existingSession.sessionId,
          jti: payload.jti,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        await this.sessionService.revokeAllActiveSessions(payload.sub);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions have been revoked',
        );
      }
    }

    const bindingEvaluation = this.securityService.evaluateSessionBinding(existingSession, context);
    if (bindingEvaluation.shouldReject) {
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
      this.logger.warn({
        event: 'auth_refresh_user_not_found',
        userId: existingSession.userId,
      });
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
